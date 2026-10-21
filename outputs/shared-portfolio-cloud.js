(() => {
  const cfg = window.PORTFOLIO_CLOUD_CONFIG || {};
  const keys = [
    'portfolio-about-summary', 'portfolio-experience', 'portfolio-specializations',
    'portfolio-skills', 'portfolio-strengths', 'portfolio-projects',
    'portfolio-certifications', 'portfolio-qualifications', 'portfolio-works', 'portfolio-tools'
  ];
  const configured = Boolean(cfg.supabaseUrl && cfg.publishableKey && window.supabase?.createClient);
  let client;
  let user = null;
  let recoveryMode = false;
  let saveTimer = 0;
  let updatingLocalCopy = false;
  let readyResolve;
  window.portfolioCloudReady = new Promise((resolve) => { readyResolve = resolve; });
  window.portfolioCloud = {
    enabled: configured,
    get recoveryMode() { return recoveryMode; },
    async updatePassword(password) {
      if (!configured) throw new Error('Shared editing is not configured.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message || 'Could not update the password.');
      recoveryMode = false;
    },
    async signIn(password) {
      if (!configured) throw new Error('Shared editing is not configured yet. Add the Supabase project URL and publishable key first.');
      const { data, error } = await client.auth.signInWithPassword({ email: cfg.ownerEmail, password });
      if (error) throw new Error('Owner sign-in failed. Check the password and the owner account setup in Supabase.');
      user = data.user;
      const { data: row, error: readError } = await client.from('portfolio_site').select('content').eq('slug', 'main').maybeSingle();
      if (readError) throw new Error('Could not load shared portfolio data. Check the Supabase table and policies.');
      if (row?.content) return;
      await this.pushLocalState();
    },
    async pushLocalState() {
      if (!configured || !user) throw new Error('Sign in to the owner account before publishing edits.');
      const content = {};
      keys.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value !== null) content[key] = value;
      });
      const uploadedAssets = new Map();
      const externalize = async (value) => {
        if (typeof value === 'string' && /^data:[^;,]+(?:;[^,]*)?,/i.test(value)) {
          if (uploadedAssets.has(value)) return uploadedAssets.get(value);
          const blob = await (await fetch(value)).blob();
          if (blob.size > 50 * 1024 * 1024) throw new Error('An uploaded file is larger than the 50 MB cloud limit.');
          const extension = ({
            'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
            'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls', 'text/plain': 'txt', 'text/rtf': 'rtf', 'text/csv': 'csv'
          })[blob.type] || 'bin';
          const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await client.storage.from('portfolio-assets').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
          if (uploadError) throw new Error('Could not upload a portfolio file. Check the Supabase Storage bucket and policies.');
          const { data } = client.storage.from('portfolio-assets').getPublicUrl(path);
          uploadedAssets.set(value, data.publicUrl);
          return data.publicUrl;
        }
        if (Array.isArray(value)) return Promise.all(value.map(externalize));
        if (value && typeof value === 'object') {
          const entries = await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await externalize(entry)]));
          return Object.fromEntries(entries);
        }
        return value;
      };
      for (const key of keys) {
        if (typeof content[key] !== 'string') continue;
        const trimmed = content[key].trimStart();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
        try {
          const normalized = await externalize(JSON.parse(content[key]));
          content[key] = JSON.stringify(normalized);
          if (content[key] !== localStorage.getItem(key)) {
            updatingLocalCopy = true;
            localStorage.setItem(key, content[key]);
            updatingLocalCopy = false;
          }
        } catch (error) {
          updatingLocalCopy = false;
          throw error;
        }
      }
      const { error } = await client.from('portfolio_site').upsert({
        slug: 'main', owner_id: user.id, content, updated_at: new Date().toISOString()
      }, { onConflict: 'slug' });
      if (error) throw new Error('Could not publish changes. Check the Supabase RLS policies and try again.');
    }
  };

  if (configured) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryMode = true;
        window.dispatchEvent(new Event('portfolio-password-recovery'));
      }
    });
    Promise.all([
      client.auth.getSession().then(({ data }) => { user = data.session?.user || null; }),
      client.from('portfolio_site').select('content').eq('slug', 'main').maybeSingle().then(({ data, error }) => {
        if (!error && data?.content) {
          keys.forEach((key) => {
            if (typeof data.content[key] === 'string') localStorage.setItem(key, data.content[key]);
            else localStorage.removeItem(key);
          });
        } else if (error) {
          console.error('Portfolio cloud read failed:', error.message);
        }
      })
    ]).catch((error) => console.error('Portfolio cloud initialization failed:', error)).finally(readyResolve);
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const result = originalSetItem.call(this, key, value);
      if (this === localStorage && keys.includes(String(key)) && user && !updatingLocalCopy) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => window.portfolioCloud.pushLocalState().catch((error) => console.error(error)), 700);
      }
      return result;
    };
  } else {
    readyResolve();
  }
})();
