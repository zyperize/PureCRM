# Excel and CSV Import Guide

PureCRM accepts modern Excel `.xlsx` files and `.csv` files.

## Minimum information

Each row needs at least one usable identity:

- a company/contact name,
- an email,
- or a phone number.

Rows with only an email or phone are valid. The CRM uses that value as the
display name until it is edited.

## Automatically recognized headings

- Name: `Company`, `Company Name`, `Business Name`, `Contact Name`, `Full Name`
- Contact: `Email`, `Work Email`, `Phone`, `Mobile`, `Telephone`
- Location: `Address`, `City`, `Town`, `State`, `Province`, `ZIP`, `Postcode`
- CRM: `Stage`, `Status`, `Source`, `Tags`, `Notes`
- Optional: website, rating, coordinates, review count, and map URL

Column names are case-insensitive and may contain spaces, underscores, or
punctuation.

## Import steps

1. Open **Import Data** in the sidebar. You can also use
   **Settings → Data & Workspace → Import & Export**.
2. Choose an Excel or CSV file.
3. Review the matched preview.
4. Click **Import**.
5. Skip, review, or intentionally keep any detected duplicates.

The downloadable template is optional; existing business spreadsheets usually
work without editing.

## Export

Use **Export All Leads** to download CRM leads as CSV. For a complete portable
copy including notes, tasks, and settings, use **Settings → Data & Workspace →
Workspace & Database → Download backup**.
