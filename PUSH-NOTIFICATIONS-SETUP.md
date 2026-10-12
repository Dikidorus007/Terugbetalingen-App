# Pushmeldingen instellen voor Terugbetalingen-App

De PWA-bestanden en client-side meldingen staan in deze branch. Pushmeldingen wanneer de app niet open is vereisen nog een eenmalige Supabase-configuratie.

## 1. Maak VAPID-sleutels aan
Genereer een VAPID public/private key-paar met een vertrouwde Web Push-tool (bijvoorbeeld lokaal met `npx web-push generate-vapid-keys`). Deel of commit de private key nooit.

## 2. Maak de tabel aan
Open Supabase Dashboard → SQL Editor en voer de SQL uit uit:
`supabase/migrations/20261012000000_push_subscriptions.sql`

## 3. Stel Edge Function secrets in
Deploy `supabase/functions/notify-new-expense/index.ts` als Edge Function met de naam `notify-new-expense`. Stel deze secrets in bij Supabase:
- `VAPID_PUBLIC_KEY`: de publieke VAPID-sleutel
- `VAPID_PRIVATE_KEY`: de private VAPID-sleutel
- `VAPID_SUBJECT`: een contact-URL of mailto-adres dat je beheert
- `WEBHOOK_SECRET`: een lange willekeurige geheime waarde

Supabase levert `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` normaal als functie-omgevingvariabelen. Controleer dit in het project en voeg ze toe als ze ontbreken. Gebruik de service-role sleutel uitsluitend als Edge Function secret, nooit in de browser.

## 4. Stel de Database Webhook in
In Supabase → Database → Webhooks maak je een webhook:
- Tabel: `public.expenses`
- Event: alleen `INSERT`
- Methode: `POST`
- URL: `https://<project-ref>.supabase.co/functions/v1/notify-new-expense`
- Header: `x-webhook-secret: <dezelfde WEBHOOK_SECRET>`
- Payload: de standaard database-webhook payload.

## 5. Zet de publieke sleutel in de app
Open `index.html` en vervang `VUL_HIER_DE_PUBLIEKE_VAPID_SLEUTEL_IN` bij `VAPID_PUBLIC_KEY` door de publieke sleutel. Commit die wijziging. De private sleutel blijft uitsluitend in Supabase.

## 6. Gebruikers melden zich aan
Iedere gebruiker opent de app, logt in en kiest Instellingen → Meldingen inschakelen op elk apparaat. Op iPhone moet de website eerst via Delen → Zet op beginscherm worden toegevoegd en daarna vanuit dat beginscherm geopend worden. Meldingen vereisen toestemming van de gebruiker.

## Opmerking over accountnamen
Push wordt gericht aan personen in de kostverdeling en aan leden van gedeelde rekeningen in `accounts.members`. Controleer of die namen overeenkomen met `people.name` / de namen waarmee gebruikers de app gebruiken. Test met twee accounts voordat je het breed gebruikt.
