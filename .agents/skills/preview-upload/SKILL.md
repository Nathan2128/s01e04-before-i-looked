---
name: preview-upload
description: Save a rig page as one HTML file and put it on a public link with the Vercel CLI, then upload over the same link without the lane marker (ADR 0003). Use for a plan's "Preview for review" and "Clean up" issues.
---

# preview-upload

Host: Vercel CLI, personal scope (`vercel teams ls`; never a work team). Ask the human before
each upload: what, where, who can see it, how to undo it (`vercel remove <project>`).

1. Save the page by command, outside the repo (previews never go in the repo, ADR 0003):

   ```sh
   mkdir -p ../rig-<plan>-preview
   PORT=8799 pnpm start &            # LANE_MARKER from .env
   curl -sf localhost:8799/<page> -o ../rig-<plan>-preview/index.html
   ```

2. Publish: `cd ../rig-<plan>-preview && vercel deploy --prod --yes --scope <personal-scope>`.
   The `Aliased:` line is the public link. Check it from outside: `curl -s -o /dev/null -w
   "%{http_code}" <link>` must say 200, and the body must match the saved file.
3. Send the link. Keep the preview issue open until the reviewer has looked.
4. Clean up: save again with `LANE_MARKER=` unset (banner reads "no marker set"), deploy again
   from the same folder (same project, same link), and curl the link to check the marker is gone.
