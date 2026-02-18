# Gerwulf Systems Website

This is the official landing page for **Gerwulf Systems** - Software solutions for the modern age.

Website: [https://gerwulf.co](https://gerwulf.co)

## 🚀 Deployment Instructions

### Step 1: Copy the Logo File

1. Copy `app_logo_light.png` from your MAUI project to this folder:
   ```
   Copy from: Building Designer Project Portal\Resources\Images\app_logo_light.png
   Copy to: website\logo-light.png
   ```

### Step 2: Push to GitHub

1. Commit all files in the `website` folder:
   ```bash
   git add website/
   git commit -m "Add Gerwulf Systems website"
   git push origin master
   ```

### Step 3: Enable GitHub Pages

1. Go to your GitHub repository: https://github.com/Gearbox73/Building-Designer-Project-Portal
2. Click **Settings** (top right)
3. Scroll down to **Pages** (left sidebar)
4. Under **Source**, select:
   - Branch: `master`
   - Folder: `/website`
5. Click **Save**
6. GitHub will provide a URL (e.g., `https://gearbox73.github.io/Building-Designer-Project-Portal/`)

### Step 4: Configure Custom Domain in GitHub

1. Still in **Settings > Pages**
2. Under **Custom domain**, enter: `gerwulf.co`
3. Click **Save**
4. Check **Enforce HTTPS** (after DNS propagates)

### Step 5: Update DNS on GoDaddy

1. Log into your GoDaddy account
2. Go to **My Products** > **Domains** > **gerwulf.co** > **DNS**
3. Add/Update these DNS records:

   **For Root Domain (gerwulf.co):**
   - Type: `A`
   - Name: `@`
   - Value: `185.199.108.153`
   
   - Type: `A`
   - Name: `@`
   - Value: `185.199.109.153`
   
   - Type: `A`
   - Name: `@`
   - Value: `185.199.110.153`
   
   - Type: `A`
   - Name: `@`
   - Value: `185.199.111.153`

   **For WWW Subdomain (www.gerwulf.co):**
   - Type: `CNAME`
   - Name: `www`
   - Value: `gearbox73.github.io`

4. Save all changes

### Step 6: Wait for DNS Propagation

- DNS changes can take **10 minutes to 48 hours** to propagate worldwide
- Check status at: https://dnschecker.org
- Enter `gerwulf.co` to see propagation status

### Step 7: Verify

Once DNS propagates:
- Visit https://gerwulf.co
- Visit https://www.gerwulf.co
- Both should show your website with HTTPS enabled

## 📁 Files in This Website

- `index.html` - Main landing page
- `styles.css` - Brand styling with your company colors
- `logo-light.png` - Your company logo (copy from MAUI project)
- `CNAME` - Custom domain configuration for GitHub Pages
- `README.md` - This file

## 🎨 Brand Colors Used

- **Orange**: `#d67105` (Primary brand color)
- **Light Grey**: `#D3D3D3` (Accents)
- **Grey**: `#525252` (Text and sections)
- **White**: `#ffffff` (Background)

## 📧 Contact

Email: info@gerwulf.co

## 🔄 Future Updates

To update the website:
1. Edit the files in the `website` folder
2. Commit and push to GitHub
3. Changes will appear at gerwulf.co within minutes

## 📝 Adding More Pages Later

When you're ready to expand:
1. Create new HTML files (e.g., `products.html`, `about.html`)
2. Add navigation links in `index.html`
3. Keep the same styles for consistency
4. Commit and push to deploy

---

**Built by Gerwulf Systems**
