# 🍿 StreamScore

A high-performance, completely native browser extension that seamlessly injects Movie Ratings (Rotten Tomatoes, IMDb, TMDb) directly into your favorite streaming sites like Amazon Prime Video and Netflix!

## ✨ Features

- **Universal Multi-Platform Support**: Custom DOM injectors automatically find movie and TV show titles inside standard Google searches, visually intensive Netflix Carousels, and highly localized Amazon Prime interfaces across multiple international domains (`.com`, `.de`, `.co.uk`).
- **Resilient Multi-Phase Searching**: Uses an advanced Fuzzy Match loop. If an exact title match isn't found, the API iterates through the Top 3 fuzzy database matches sequentially and locks onto the first actual blockbuster with a verified rating—ignoring obscure unrated indie films or identical shorts.
- **TMDb Auto-Parachute**: Features a state-of-the-art fallback architecture. If your OMDb API hits its 1,000-request daily limit or the connection fails, the extension instantly catches the error mid-flight and seamlessly routes queries to **The Movie Database (TMDb)**, feeding ultra-fast cyan `📊 Community Scores` to the frontend without missing a beat!
- **IMDb Fallback Capabilities**: Provides a gorgeous gold `⭐ IMDb` badge if a title strictly features an IMDb rating but no Rotten Tomatoes freshness index.
- **Military-Grade Local Caching**: Extensively saves successful ratings (and empty 'Not Found' strings) directly into your browser's local memory for 7 days. Once a movie is loaded once, the network is never touched again, effectively immunizing you from rate limits.
- **Aggressive Title Stripping**: Features advanced RegExp cleaning techniques designed to strip messy localized streaming metadata before querying databases (e.g. effortlessly identifying `"Suits [dt./OV]"` or `"The Night Manager - Staffel 2 (4K UHD)"` as their root titles).

## 🚀 Setup & Installation

This extension connects to free movie databases to fetch live scores. You will need to drop free API keys into the Extension's popup!

1. Install the Extension in your browser.
2. Register for a free [OMDb API Key](https://www.omdbapi.com/apikey.aspx) (Primary database for Rotten Tomatoes scores).
3. **[Highly Recommended]** Register for a free [TMDb API Token](https://www.themoviedb.org/settings/api) (Functions as an unrestricted infinite parachute if OMDb fails).
4. Click your new Extension Icon in the toolbar, paste both keys into the input UI, and hit **Save Keys**.

## 🎨 Visual System

The injected tags dynamically style themselves so you immediately know where the score is coming from natively:
* 🍅 **Fresh**: Red gradient Rotten Tomatoes badge (`> 60%`)
* 🤢 **Rotten**: Green gradient Rotten Tomatoes badge (`< 60%`)
* ⭐ **IMDb**: Gold gradient for shows defaulting to IMDb.
* 📊 **TMDb**: Sleek Cyan/Blue gradient indicating your OMDb key failed and the TMDb Fallback Parachute engaged.
* **[Limit]** / **[API Key]**: Explicit gray debug badges warning you if your limits are hit and you haven't provided a TMDb fallback key.