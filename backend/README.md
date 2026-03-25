# Pages Backend

## Setup

1. Create env file

```
MONGO_URI=mongodb://localhost:27017/pages
JWT_ACCESS_SECRET=change_me_dev_access
JWT_REFRESH_SECRET=change_me_dev_refresh
CORS_ORIGIN=http://localhost:5173
PORT=4000
NODE_ENV=development
FILE_MAX_SIZE_BYTES=5242880
```

2. Install deps

```
npm install
```

3. Run dev

```
npm run dev
```

API runs on http://localhost:4000

## Notes
- JWT access (Authorization: Bearer) + refresh (httpOnly cookie)
- Upload image: POST /api/uploads/images (multipart field name: file)
- Static uploads served at /uploads

