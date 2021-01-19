# Personal blog page

This project is a personal web page, it is using Jekyll that simplifies the creation of simple
static blog pages. 

## Creating a new post

* Add a new file in `_posts` folder using the following name: `year-month-day-title.markdown`.
* Create the post content using markdown syntax.

## Run locally

```bundle exec jekyll serve```

## Build for production locally (github pages already does this when pushing to master)

```JEKYLL_ENV=production bundle exec jekyll build```