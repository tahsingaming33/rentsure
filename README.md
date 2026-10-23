# Rentsure

- Website: https://rentsurebd.vercel.app
- Admin: https://rentsurebd.vercel.app/admin
- Every push to `main` goes live automatically on Vercel in about a minute.

## Daily use
1. A customer fills the form and taps the WhatsApp button. You get their WhatsApp message, and a copy is saved in the admin.
2. Open the admin, tap the request, tap **Reply on WhatsApp**.
3. Move it along: New > Contacted > Quoted (add the price) > Booked or Lost. Add notes like driver name or advance paid.
4. Booked trips show under "Upcoming booked trips". Export everything with **Export CSV**.

Tip: open the admin on your phone and use "Add to Home Screen". It opens like an app.

## Setup (done)
- Hosting: Vercel project `rentsure`, linked to this repo.
- Database: Upstash for Redis (free plan), connected in Vercel Storage.
- `ADMIN_PASSWORD`: set in Vercel > Settings > Environment Variables. Change it there, then redeploy.

## Notes
- Spam protection: hidden honeypot field and max 8 requests per 10 minutes per visitor.
- WhatsApp number used on the site: 01403009455 (wa.me/8801403009455).
