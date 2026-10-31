/* Formulation Trendline — site configuration.
   Edit these three values, commit, and GitHub Pages serves the change. */
window.TRENDLINE_CONFIG = {
  /* OAuth 2.0 Client ID (type "Web application") from Google Cloud Console.
     Authorized JavaScript origins must include this site's address,
     e.g. https://YOUR-GITHUB-USERNAME.github.io  (see README, step 2). */
  googleClientId: 'PASTE-YOUR-CLIENT-ID.apps.googleusercontent.com',

  /* The "Formulation Trendline — live feed" sheet (IMPORTRANGE of All_Data). */
  feedSheetId: '1m0VuAyeN1YB1hWgQtasHFNoatIKgDO1gWH-LKw6tbSA',

  /* Range read from the feed. No tab name = the first tab. */
  range: 'A:BI',

  /* Optional: only offer accounts from this Google Workspace domain. '' = any. */
  hostedDomain: 'atbme.org',

  /* Re-read the feed this often while the page is open (minutes). 0 = off. */
  refreshMinutes: 5
};
