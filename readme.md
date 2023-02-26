# website-crawler-puppeteer

A simple node.js web crawler application using puppeteer and downloading specific files.

## Install Node.js

This project requires the node.js runtime.

You can download node.js from [here](https://nodejs.org/en/download/).

## Git Bash Terminal Window

If you are on Windows, please make sure you have `Git` installed
so that you have access to a `Git Bash` terminal window.

All commands in this readme.md file will be using linux commands.

## Install Project Dependencies

To install and node.js project dependencies, run:

```sh
npm install
```

## Create .env file

Create an `.env` file with these environment variables

```txt
USER_NAME='some user name'
USER_PASSWORD='some user password'

PERFORM_PDFS_CLEANUP='false'
PERFORM_PDFS_DOWNLOAD='false'

PERFORM_MP3S_CLEANUP='false'
PERFORM_MP3S_DOWNLOAD='false'

CREATE_COURSES_FOLDER_STRUCTURE='false'

COURSES_TO_PROCESS=''

COURSE_TO_PROCESS=''

MAX_VIDEOS_TO_DOWNLOAD='50'

COURSE_SUMMARY_MAIN_DIR=''

COURSE_SUMMARY_INCLUDE_FILE_DETAILS='false'
```

## Formatting files

To prettify and lint all files in the workspace, run this command:

```sh
npm run formatFiles
```

## Running the crawler application

To run the crawler application, run this command:

```sh
node crawler.js | tee crawler_out.log
```

This will direct all output to the crawler_out.log and also
display the output in the terminal at the same time.

## Running the file downloader application

```sh
node download_lessons.js | tee download_lessons_out.log
```

## Running the course summary application

```sh
node printCourseContentSummaries.js | tee print_summaries_out.log
```
