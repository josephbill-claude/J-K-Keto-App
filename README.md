# J & K’s Keto Meals

A keto recipe app that installs on any phone and gets new recipes every Monday, automatically.

- `site/` is the app itself (what people open and install).
- `site/recipes-extra.json` holds the weekly recipes. The robot adds to it; you never need to edit it.
- `scripts/generate-recipes.mjs` asks Claude for new recipes and checks them.
- `.github/workflows/publish.yml` runs the robot every Monday at 06:00 UTC and publishes the site.

## One-time setup (about 15 minutes, on a computer)

1. **API key.** Sign in at console.anthropic.com, add some credit (£5 lasts well over a year at this usage) and set a monthly spend limit under Billing. Create an API key and copy it.
2. **GitHub repo.** Create a free account at github.com, then click **New repository**. Name it e.g. `keto-meals`, make it **Public** (needed for free GitHub Pages) and create it.
3. **Upload the files.** On the new repo page click **uploading an existing file** and drag in the *contents* of this folder (`site`, `scripts`, `.github`, `README.md`), then **Commit changes**.
   - On a Mac the `.github` folder is hidden. In Finder press **Cmd + Shift + .** to show it.
   - If `.github` didn’t upload, use **Add file → Create new file**, type `.github/workflows/publish.yml` as the name, paste in that file’s contents and commit.
4. **Add the key.** Repo **Settings → Secrets and variables → Actions → New repository secret**. Name: `ANTHROPIC_API_KEY`. Value: your key.
5. **Turn on the website.** Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
6. **First run.** **Actions** tab → **Weekly recipes and publish** → **Run workflow**. After a couple of minutes your app is live at `https://YOUR-USERNAME.github.io/keto-meals/`. Share that link.

From then on it runs every Monday by itself.

## Already shared a Netlify link?

Keep it: in Netlify open your site → **Site configuration → Build & deploy → Link repository**, choose this repo, leave the build command empty and set the publish directory to `site`. Netlify then republishes every time the robot adds recipes. (You can skip step 5.)

## Checking on it

- The **Actions** tab shows each Monday’s run. Open a run to see the recipe names it added.
- If a run fails (red cross) GitHub emails you. Common causes: no API credit left, or the key was removed. Nothing in the app breaks; it just doesn’t get new recipes that week.
- To remove a recipe you don’t like, open `site/recipes-extra.json`, click the pencil, delete that recipe’s `{ ... }` block and commit.

## Settings you can change

In `publish.yml`, under the “Write this week’s recipes” step `env:`, you can add:
- `RECIPE_COUNT: 10` for more recipes per week
- `MODEL: claude-haiku-5-5` for a cheaper model

To change the day or time, edit the `cron` line (it’s in UTC).
