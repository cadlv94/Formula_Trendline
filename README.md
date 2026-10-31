# Formulation Trendline

CoA potency trending for PerfectionRx 503A sterile compounding, by ingredient
(tirzepatide, semaglutide, cyanocobalamin, glycine, niacinamide B3, dexpanthenol B5).
It shows control limits, excursions, day/week summaries and a compounder leaderboard.

This is a static site for GitHub Pages. **No data is stored in this repository.**
Viewers sign in with Google, and the page reads the *Formulation Trendline — live feed*
sheet with the Sheets API (read-only). Only accounts that can open that sheet see data.
The access token stays in browser memory and is never saved.

```
index.html        page markup
css/app.css       styles
js/config.js      the only file you normally edit
js/app.js         charts, tables, verdict logic
js/live.js        Google sign-in and reading the feed
```

## Setup (about 15 minutes, one time)

### 1. Put the code on GitHub

1. Create a repository, e.g. `formulation-trendline`.
   - **Public**: GitHub Pages is free. The code holds no lot data, but it does hold the feed sheet's ID.
     Only people with access to the sheet can read it.
   - **Private**: GitHub Pages from a private repo needs GitHub Pro, Team or Enterprise.
2. Upload these files. Either:
   - drag them into the repo page on github.com, or
   - in VS Code, open this folder and click **Source Control → Publish to GitHub**.

### 2. Create the Google sign-in (OAuth Client ID)

1. Go to <https://console.cloud.google.com/> and sign in with your atbme.org account.
2. Create a project, e.g. *Formulation Trendline*.
3. Go to **APIs & Services → Library**, search **Google Sheets API** and click **Enable**.
4. Go to **APIs & Services → OAuth consent screen** (*Google Auth Platform → Branding / Audience*):
   - Audience: **Internal**. Only atbme.org accounts can sign in, and Google does not need to review the app.
   - App name: *Formulation Trendline*. Add your support email.
   - Data access: add the scope `.../auth/spreadsheets.readonly`.
5. Go to **Clients → Create client**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `https://YOUR-GITHUB-USERNAME.github.io`
     (and `http://localhost:8000` if you want to test on your own machine).
   - No redirect URIs are needed.
6. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
7. Paste it into `js/config.js` as `googleClientId`, then commit.

### 3. Turn on GitHub Pages

In the repo, go to **Settings → Pages**, set **Source: Deploy from a branch**, then **Branch: main / (root)**,
and click **Save**. About a minute later the site is live at
`https://YOUR-GITHUB-USERNAME.github.io/formulation-trendline/`.

### 4. Give people access

Anyone who should use the page needs Viewer access to the
**Formulation Trendline — live feed** sheet in Google Drive. Access is managed in Drive, not GitHub.

## Everyday use

- Data updates by itself. Edit the trending workbook and the feed sheet mirrors it with IMPORTRANGE.
  The page re-reads the feed every 5 minutes while it is open, or when you press **Refresh**.
- Google sign-in lasts about an hour. After that, Refresh asks you to sign in again.
- To change the feed sheet, refresh interval or allowed domain, edit `js/config.js`.

## Test locally

```
python -m http.server 8000
```

Then open <http://localhost:8000>. The origin `http://localhost:8000` must be in the Client ID's
Authorized JavaScript origins.

## Troubleshooting

| Message on the page | Fix |
|---|---|
| One setup step left | `googleClientId` in `js/config.js` is still the placeholder. |
| Error 400 `origin_mismatch` in the Google popup | Add the exact site address to Authorized JavaScript origins. Use the origin only, with no `/formulation-trendline` path. |
| The Google Sheets API is not enabled | Setup step 2.3. |
| Your account cannot open the live feed sheet | Share the feed sheet with that account. |
| The live feed needs one click to start | Open the feed sheet and click **Allow access** on the IMPORTRANGE cell. |
| The sign-in window was blocked | Allow pop-ups for the site. |
