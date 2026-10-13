---
name: publish-kitchen
description: Publish Pantry Host kitchens as EPUB cookbooks and push them to an e-reader, through a Google Drive folder the Kindle imports from, a local folder, or Send to Kindle email. Use when the user asks for an ebook, EPUB or cookbook of a kitchen, to send recipes to their Kindle or e-reader, or to refresh a kitchen book they published before.
---

# Publish kitchens as EPUBs

Builds each kitchen into a static EPUB in this session and delivers the file, so the e-reader only has to read it. It never needs to reach the Pantry Host server, which matters because e-readers like the Kindle Scribe can't join Tailscale and lose the app once they're off home Wi-Fi.

- Engine: `packages/app/scripts/publish-book.ts` (fetch, photos, cover, pandoc).
- Book layout: `packages/shared/src/export-book.ts`.
- One book per kitchen, named `pantry-host-<slug>.epub`. It contains:
  - a photo cover;
  - active menus, grouped by course;
  - recipes A–Z, under letter headings for kitchens with more than 40 recipes;
  - an index by tag;
  - an About page.

## 1. Preflight

1. **Tools:** run `pandoc --version` (it must be 3 or newer) and `magick -version`. If either is missing, tell the user the fix, `brew install pandoc imagemagick`, and ask before running it yourself.
2. **Defaults:** read them from the repo-root `.env.local`. That file is gitignored, so never copy its values into tracked files.

   | Variable | Used for | Default |
   |---|---|---|
   | `GRAPHQL_URL` | where the kitchens are | `http://localhost:4001/graphql` |
   | `APP_URL` | the second place `/uploads/` photos are looked for | `http://localhost:3000` |
   | `KINDLE_DRIVE_FOLDER_ID` | the Drive folder the e-reader imports from | |
   | `KINDLE_EMAIL` | the Send to Kindle address | |

3. **List kitchens:** `npx tsx packages/app/scripts/publish-book.ts --list`.
   - If it can't reach the server, ask which server holds the kitchens and pass its URL as `GRAPHQL_URL=http://<host>:4001/graphql`.
   - If that server runs the Node GraphQL server rather than the Rust one, also set `APP_URL=http://<host>:3000`. Rex serves the uploads there.

## 2. Ask

Ask everything in one AskUserQuestion call. Skip any question the request already answers; for example, "send the bar book to my kindle" names the kitchen and the destination.

1. **Kitchens** (multiSelect, from `--list`).
2. **Destination:**
   - **Kindle Drive folder** (Recommended when `KINDLE_DRIVE_FOLDER_ID` is set). The Kindle Scribe imports EPUBs from Google Drive.
   - **Another Google Drive folder:** the user pastes a folder link.
   - **Local folder only:** `exports/` at the repo root.
   - **Send to Kindle email** (`KINDLE_EMAIL`): text-only edition, see step 4.

   Say in the question that Drive and Kindle put the book on Google's or Amazon's servers. Everything else in Pantry Host stays on the user's hardware.
3. **Photos:**
   - **Color** (Recommended), for the Kindle Colorsoft, tablets and phones.
   - **Grayscale**, for black-and-white e-ink; the file is also smaller.
   - **None.**

   Email forces None.

## 3. Build

```
npx tsx packages/app/scripts/publish-book.ts --kitchen <slug> [--kitchen <slug> …] \
  --photos <color|gray|none> [--drive-folder <folder ID or link>]
```

`--all` publishes every kitchen.

- Progress goes to stderr. Stdout is one JSON summary: `books[]`, each with `file`, `bytes`, `recipes`, `menus`, `photos`, `missingPhotos[{title, reason}]` and `drive`.
- Books always land in `exports/` too.
- Publishing again overwrites the same file name, so a Drive file keeps its Drive ID. Whether the Kindle replaces or duplicates a re-imported book is still unconfirmed, so mention that on refreshes.

## 4. Deliver and verify

**Google Drive.** `--drive-folder` finds the Drive for desktop folder on this Mac whose item ID matches. It copies the book in and waits for Drive to assign `drive.fileId`. Drive for desktop then uploads it from disk, so size doesn't matter.

- **Confirm it arrived:** call the Drive connector's `get_file_metadata` on `drive.fileId`. Check that `parentId` is the folder and `fileSize` equals `bytes`.
- **When `drive.replaced` is true**, Drive kept the old file's ID but may take a minute to upload the new version. If `fileSize` still shows the old size, wait 15–30 seconds and check again, for up to about 2 minutes, before reporting a problem.
- **If `fileId` is null:** search `parentId = '<folder>' and title = '<file name>'`.
- **Don't upload with the connector's `create_file`.** It takes the file as base64 inside the tool call, which works only for a few KB.
- **If no Drive for desktop folder matches**, say so and offer the local folder.

**Send to Kindle email.** Use this only for text-only editions (`--photos none`) under about 60 KB. The Gmail connector carries attachments as base64 inside the tool call, so you have to output the file's base64 exactly.

1. **Recipient:** use `KINDLE_EMAIL`. If it isn't set, ask for the address and offer to save it in `.env.local`.
2. **Confirm first:** before sending, show the recipient, the file and its size, and get a clear yes in chat.
3. **Send:** use `send_message` with `to: [KINDLE_EMAIL]` and the book title as the subject. Attach the output of `base64 -i <file>` with `mimeType: application/epub+zip` and the file name.
4. **Approved senders:** remind the user that the sending address must be on Amazon's approved sender list for Send to Kindle.
5. **Don't verify by reading mail.** Never read the mailbox to check the send.

For a photo edition by email, use Gmail in the user's Chrome instead. Attach the file with the extension's file upload, which reads it from disk (10 MB limit). Confirm before clicking Send.

## 5. Report

Report each book on one line:
- title;
- recipe and menu counts;
- photo count;
- size;
- where it went, with the Drive link `https://drive.google.com/file/d/<fileId>/view` when there is one.

**Missing photos:** list `missingPhotos` with their reasons. These are broken photo links in the recipes themselves (404s, expired links, a page instead of an image), so the app doesn't show them either. Offer to fix them: find a new photo and set it with `updateRecipe`, as CLAUDE.md's Recipe creation section describes.

**Kindle Scribe tips:**
- A book imported from Drive follows dark mode only after the user turns on **Use system theme** in the book's **Aa** menu. It's off by default.
- The sidebar icon in these books is for annotations. The table of contents is under **Go to**.
