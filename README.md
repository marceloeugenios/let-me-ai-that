# Let Me AI That For You

"Let Me Google That For You", but for AI chats. Make a link with a question; whoever opens it
watches the question get typed into a chat box, then lands in their own AI with the question filled in.

## How it works

- The home page makes a link like `/#q=how+do+I+center+a+div&ai=claude`. The question sits after
  the `#`, so it never reaches the server.
- `ai` is only a suggestion. The first time someone opens a link they pick their AI; the choice is
  saved in `localStorage` and used for every later link. "Use a different AI" clears it.
- Claude, ChatGPT and Perplexity take the question from the URL. Gemini and Codex have no known
  prefill link, so the page copies the question and opens the tool for the user to paste.

Add or change an AI in the `AIS` map at the top of `app.js`.

## Run locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. Plain HTML/CSS/JS, no build step; any static host works
(GitHub Pages, Cloudflare Pages, Vercel).
