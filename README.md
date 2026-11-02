# Step Duel

A minimal website where Bipu and Noma log daily steps and weight and compare them in two charts. It's a plain static site (GitHub Pages) that keeps its data in a free Supabase database, so both phones stay in sync.

## Setup

1. **Database:** in Supabase open **SQL Editor → New query**. Paste `supabase.sql`, change `CHANGE-ME` to your passcode, and press **Run**.
2. **Connect:** in Supabase open **Project Settings → API**. Copy the Project URL and the anon public key into `config.js`.
3. **Publish:** in GitHub open **Settings → Pages**. Set Source to *Deploy from a branch*, choose `main` and `/ (root)`, and save. The site appears at `https://naomirajwanshi02.github.io/step-duel/`.
4. **Phones:** open the link, enter the passcode once, then add the page to your home screen:
   - iPhone: Share → Add to Home Screen.
   - Android: ⋮ → Add to Home screen.

The phones refresh the data every 15 seconds while the page is open, and whenever you switch back to it.

## Files

- `index.html`, `app.js`: the page.
- `config.js`: the Supabase URL and anon key.
- `supabase.sql`: the table, plus the passcode rule that protects it.
- `manifest.webmanifest`, `icon*`: the home-screen icon.
