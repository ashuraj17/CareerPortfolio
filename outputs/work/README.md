# Manage the work gallery

Use the star button in the **Selected Work** section. Enter the same owner password used for the other portfolio editors, then create a new item or select an existing item to edit or remove it. You can upload PDF, PPTX, DOCX, text/CSV, image, and video previews. PPTX presentations open in slideshow view.

Saving downloads an updated `portfolio-items.js` file. Replace `outputs/work/portfolio-items.js` with that downloaded file and refresh the portfolio to keep the changes in its source files.

## Manual editing

Place each public preview file in `outputs/work/files/`, then add an entry to `portfolio-items.js`:

```js
{
  title: "Project title",
  category: "Equity research",
  description: "A short description of the work.",
  file: "project-preview.pdf",
  type: "pdf"
}
```

Supported preview types are `pdf`, `pptx`, `docx`, `text`, `image`, and `video`. The local PPTX viewer shows slides with text and embedded images; the DOCX viewer shows document text. For full visual fidelity, export office files to PDF. Published PPTX/DOCX files can use the Microsoft Office web viewer when their asset URL is public.

## View-only limitation

This is a static website. Hiding the PDF toolbar and download controls, and disabling the right-click menu inside the viewer, discourages casual downloading but cannot prevent a visitor from saving or capturing content that their browser can display. Do not publish private or confidential work here. Enforcing stronger access restrictions requires a hosted backend with authentication and a protected document viewer; even then, screenshots cannot be fully prevented.
