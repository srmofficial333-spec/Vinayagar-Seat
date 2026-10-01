# Vinayagar Seettu — Database + Admin Authentication

## இது என்ன?

இந்த version-ல்:

- Member list database-ல் இருக்கும்.
- ஒவ்வொரு member-க்கும் தனித்தனி payment history.
- Payment add செய்வது Admin-க்கு மட்டும்.
- Admin payment date + time + amount + Online/Cash பதிவு செய்யலாம்.
- Online payment-க்கு UPI transaction ID, Google transaction ID, sender/receiver, bank details சேர்க்கலாம்.
- Payment screenshot-ஐ குறிப்பிட்ட member/payment-க்கு Admin upload செய்யலாம்.
- Member side read-only: history பார்க்கவும் receipt/download செய்யவும் மட்டும்.
- Member payment add/edit/delete செய்ய முடியாது.
- Receipt-ல் payment screenshot இருந்தால் காட்டப்படும்.

## Install

Node.js + MySQL தேவை.

```bash
npm install
```

` .env.example `-ஐ `.env` ஆக copy செய்து MySQL details மற்றும் admin password அமைக்கவும்.

## Database

MySQL-ல்:

```bash
mysql -u root -p < schema.sql
```

## Admin உருவாக்க

முதலில் server start:

```bash
npm start
```

பிறகு ஒருமுறை:

```text
http://localhost:3000/api/setup
```

திறக்கவும்.

`.env`-ல் கொடுத்த ADMIN_USERNAME / ADMIN_PASSWORD database-ல் hash ஆக சேமிக்கப்படும்.

**Security:** `/api/setup` endpoint-ஐ first setup முடிந்ததும் disable/remove செய்யவும்.

## Open

Member page:

```text
http://localhost:3000/
```

Admin login:

```text
http://localhost:3000/login.html
```

## முக்கிய குறிப்பு

இந்த project local/server deployment-க்கு உருவாக்கப்பட்டது. GitHub Pages மட்டும் பயன்படுத்தினால் Node.js backend + MySQL இயங்காது. Backend-ஐ Node.js support உள்ள hosting-ல் deploy செய்ய வேண்டும்; database-க்கு MySQL-compatible service தேவை.

`uploads/` folder-ல் payment screenshots சேமிக்கப்படுகின்றன. Production deployment-ல் persistent/private file storage பயன்படுத்துவது பாதுகாப்பானது.
