# Google Drive Integration Setup Guide

Follow these steps to enable Google Drive storage for your university portal.

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "University-Portal-Storage").

## 2. Enable Google Drive API
1. In the sidebar, go to **APIs & Services > Library**.
2. Search for **"Google Drive API"** and click **Enable**.

## 3. Create a Service Account
1. Go to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** > **Service Account**.
3. Give it a name (e.g., "portal-storage-sa") and click **Create and Continue**.
4. Grant it the **Editor** role (or specifically "Storage Object Admin" if using GCS, but for Drive, standard Editor is fine). Click **Continue** and then **Done**.

## 4. Generate a JSON Key
1. Click on the newly created Service Account email address.
2. Go to the **Keys** tab.
3. Click **Add Key > Create New Key**.
4. Select **JSON** and click **Create**. This will download a `.json` file to your computer.
5. **KEEP THIS FILE SAFE.** You will need the `client_email` and `private_key` from it.

## 5. Prepare the Google Drive Folder
1. Open your Google Drive.
2. Create a new folder (e.g., "University Portal Uploads").
3. Get the **Folder ID** from the URL. It's the string after `folders/` in the address bar:
   `https://drive.google.com/drive/u/0/folders/YOUR_FOLDER_ID_HERE`
4. **IMPORTANT:** Click **Share** on the folder and add your **Service Account email** (from the JSON file) as an **Editor**. This allows the portal to upload files into it.

## 6. Update `.env` file
Open `Backend/.env` and add the following lines, replacing the values with your actual credentials:

```env
GOOGLE_DRIVE_CLIENT_EMAIL=your-sa-email@project.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_from_url
```

> [!TIP]
> Make sure the `GOOGLE_DRIVE_PRIVATE_KEY` is wrapped in quotes and that the `\n` characters are preserved correctly.

## 7. Starting the App
1. **Backend:**
   ```bash
   cd Backend
   npm install
   npm run dev
   ```
2. **Frontend:**
   Simply open `frontend/index.html` in your browser (or use a live server if preferred).
