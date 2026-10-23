# Rentsure website + admin

- `index.html`: the public website with the booking form. Customers send their request on WhatsApp and a copy is saved for you.
- `admin/index.html`: your dashboard at `yourdomain.com/admin`.
- `api/quotes.js`: the small server that saves and reads requests (Vercel function).

## Put it online (about 10 minutes)

1. **GitHub:** create a new repo (private is fine) and upload everything in this folder, keeping the folders as they are.
2. **Vercel:** sign in with GitHub, click **Add New > Project**, pick the repo, click **Deploy**. No settings needed.
3. **Database:** in the Vercel project open **Storage**, click **Create Database**, choose **Upstash for Redis** (free plan), and connect it to this project. Vercel adds the database keys for you.
4. **Admin password:** in **Settings > Environment Variables** add `ADMIN_PASSWORD` with a long password only you know.
5. **Redeploy:** go to **Deployments**, open the menu on the latest one, click **Redeploy** so the new settings load.
6. Open `your-site.vercel.app/admin` and sign in. Then submit a test request on the website and watch it appear.

## Before going live

- Replace the sample WhatsApp number `01940295660` / `8801940295660` in `index.html` (search for it, it appears a few times, including the `WA` constant in the script).
- Custom domain: Vercel project > **Settings > Domains**.

## Notes

- The map pin needs the real hosted site. In the Claude preview it falls back to pasting a Google Maps link.
- Requests are also never lost if saving fails: the customer's WhatsApp message always goes through.
- Spam protection: a hidden honeypot field and a limit of 8 requests per 10 minutes per visitor.
- To change the password, edit `ADMIN_PASSWORD` in Vercel and redeploy.
