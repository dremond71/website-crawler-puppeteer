require('dotenv').config();

const puppeteer = require('puppeteer');
const fs = require('fs');

const stream = require('stream');
const axios = require('axios');
const util = require('util');
const pipeline = util.promisify(stream.pipeline);

const path = require('path');
const { getVideoDurationInSeconds } = require('get-video-duration');

//const dataFileName = './tiny_download_data2.json';
const dataFileName = './yoyo_basic_lessons_feb16.json';

const data = require(dataFileName);

let page = undefined;
let browser = undefined;

async function getVideoLengthHumanFriendly(seconds) {
  let minutes = Math.floor(seconds / 60);
  let extraSeconds = Math.floor(seconds % 60);

  let value = '';
  if (minutes > 0) {
    if (minutes > 1) {
      value = value + `${minutes} minutes `;
    } else {
      value = value + `${minutes} minute `;
    }
  }

  if (extraSeconds > 0) {
    value = value + `${extraSeconds} seconds`;
  }

  return value;
}

function setLessonAsNotDownloaded(someLesson, downloadDirectory) {
  someLesson.videoLengthInSeconds = 0;
  someLesson.videoLengthHumanFriendly = '';
  someLesson.downloaded = false;
  someLesson.downloadDurationInMilliseconds = 0;

  // cleanup download directory
  deleteLessonDownloadedFiles(someLesson, downloadDirectory);
}

function deleteLessonDownloadedFiles(someLesson, downloadDirectory) {
  let binFileName = getBinFileName(someLesson);
  let binFilePath = path.join(downloadDirectory, binFileName);
  let mp4FilePath = path.join(downloadDirectory, someLesson.desiredMP4Name);

  try {
    fs.rmSync(binFilePath);
  } catch (error) {}

  try {
    fs.rmSync(mp4FilePath);
  } catch (error) {}
}

function getBinFileName(someLesson) {
  let binFileName = undefined;

  if (someLesson && someLesson.videoBinUrl) {
    const pathSegments = someLesson.videoBinUrl.split('/');

    // get the file name from last segment in the url (with .bin extension)
    binFileName = pathSegments[pathSegments.length - 1];
  }

  return binFileName;
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function writeDataFile() {
  try {
    let prettyData = JSON.stringify(data, null, 2);
    fs.writeFileSync(dataFileName, prettyData);
  } catch (error) {
    console.log(`Error saving data file`);
  }
}

function getCourseDownloadDirectoryFullPath(theCourse) {
  return path.join(__dirname, theCourse.downloadSubDir);
}

function notDownloaded(someLesson) {
  return (
    someLesson['downloaded'] == undefined || someLesson.downloaded === false
  );
}

function fileExists(fullPathToFile) {
  let exists = false;

  try {
    if (fs.existsSync(fullPathToFile)) {
      //file exists
      exists = true;
    }
  } catch (err) {
    //console.error(err)
  }
  return exists;
}

/**
 * This function downloads a lesson file.
 *
 * It does not use any puppeteer approaches since doing this
 * via the UI failed to work consistently.
 *
 */
async function downloadLessonFile(theLesson, theCourse) {
  const downloadDirectory = getCourseDownloadDirectoryFullPath(theCourse);
  //
  // only download a lesson file, if it has not already been downloaded
  //

  if (theLesson.videoBinUrl && notDownloaded(theLesson)) {
    const startTime = new Date();

    //
    // Figure out the downloaded file name
    //
    const downloadedFileNameWithBinExtension = getBinFileName(theLesson);

    let downloadedFilePath = path.join(
      downloadDirectory,
      downloadedFileNameWithBinExtension
    );

    console.log(
      `        Downloading lesson video '${theLesson.videoBinUrl}'...}`
    );

    try {
      const request = await axios.get(theLesson.videoBinUrl, {
        responseType: 'stream',
      });

      await pipeline(request.data, fs.createWriteStream(downloadedFilePath));
      console.log(`        download succeeded :)`);
    } catch (error) {
      console.log(`        download failed :(`);
    }

    const fileDoesExist = fileExists(downloadedFilePath);

    if (fileDoesExist) {
      //
      // rename the .bin file to .mp4 file
      //
      let newFilePath = path.join(downloadDirectory, theLesson.desiredMP4Name);

      let renameSuccessful = true;
      let errorMessage = undefined;
      try {
        fs.renameSync(downloadedFilePath, newFilePath);
      } catch (error) {
        renameSuccessful = false;
        errorMessage = error;
      }

      if (renameSuccessful) {
        console.log(
          `        Renamed '${getBinFileName(theLesson)}' to '${
            theLesson.desiredMP4Name
          }'`
        );
        const lengthInSeconds = await getVideoDurationInSeconds(newFilePath);
        theLesson.videoLengthInSeconds = lengthInSeconds;
        theLesson.videoLengthHumanFriendly = await getVideoLengthHumanFriendly(
          lengthInSeconds
        );
        theLesson.downloaded = true;
        const endTime = new Date();
        const differenceInMilliseconds = endTime - startTime;
        theLesson.downloadDurationInMilliseconds = differenceInMilliseconds;
        console.log(
          `        Download duratin: ${theLesson.downloadDurationInMilliseconds} (ms)\n`
        );
      } else {
        console.log(
          `        Error renaming '${downloadedFilePath}' to '${newFilePath}' " : ${errorMessage}`
        );
        setLessonAsNotDownloaded(theLesson, downloadDirectory);
      }
    } else {
      setLessonAsNotDownloaded(theLesson, downloadDirectory);
    }
  } else {
    console.log('        skipping. File already downloaded.');
  }
  // write to file on each lesson downloaded to save state.
  // sometimes a windows machine likes to reboot for an update
  // for no particular reason.

  writeDataFile();
}

const puppeteerIsHeadless = false;

async function main() {
  const performCleanUp = process.env.PERFORM_CLEANUP || 'false';
  const performDownloads = process.env.PERFORM_DOWNLOAD || 'false';

  const mainStartTime = new Date();

  // choose a course
  const theCourse = data[0];

  const doCleanUp = performCleanUp.trim().toLowerCase() === 'true';

  if (doCleanUp) {
    console.log(`\nPerforming Cleanup...\n`);
    for (const level of theCourse.levels) {
      for (const unit of level.units) {
        for (const lesson of unit.lessons) {
          setLessonAsNotDownloaded(
            lesson,
            getCourseDownloadDirectoryFullPath(theCourse)
          );
        } // lessons
      } // units
    } // levels
  }

  writeDataFile();

  //
  // Perform downloads
  //

  const doDownloads = performDownloads.trim().toLowerCase() === 'true';

  if (!doDownloads) return;

  console.log(`\nPerforming Downloads...\n`);

  let totalDownloaded = 0;

  /**
   *
   * I can use the chromium browser or chrome browser to download
   * these files. yay!
   *
   **/
  //browser = await puppeteer.launch({ headless: puppeteerIsHeadless });

  browser = await puppeteer.launch({
    headless: puppeteerIsHeadless,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });

  page = await browser.newPage();

  // Set screen size
  await page.setViewport({ width: 1080, height: 800 });

  //
  // log into website
  //
  await page.goto('https://yoyochinese.com/auth/login');
  await delay(1500);

  const userIdSelector = 'input.email-input';
  await page.waitForSelector(userIdSelector);

  const passwordSelector = 'input.password-input';
  await page.waitForSelector(passwordSelector);

  // get login data from .env file
  const myUserId = process.env.USER_NAME || '';
  const myPassword = process.env.USER_PASSWORD || '';

  // enter login in
  await page.type(userIdSelector, myUserId, { delay: 100 });
  await page.type(passwordSelector, myPassword, { delay: 100 });

  await delay(1500);

  //
  // Press the Login button
  //
  const loginButtonXPathSelector = `//span[text()="Login with Email"]`;
  await page.waitForXPath(loginButtonXPathSelector);

  let [button] = await page.$x(loginButtonXPathSelector);
  if (button) {
    await button.click();
  }

  //
  // Get to Courses page
  //
  const coursesXPathSelector = `//span[text()="Courses"]`;
  await page.waitForXPath(coursesXPathSelector);

  await delay(1500);

  await page.goto(theCourse.url);
  console.log(`\n'${theCourse.name}'\n`);
  await delay(1500);

  for (const level of theCourse.levels) {
    await page.goto(level.url);
    console.log(`\n'${level.name}'`);
    await delay(1500);

    for (const unit of level.units) {
      console.log(
        `\n\nTotal Lessons Downloaded So Far: ${totalDownloaded}\n\n`
      );
      await page.goto(unit.url);
      console.log(`\n    '${unit.shortName}'\n`);
      await delay(1500);

      for (const lesson of unit.lessons) {
        console.log(`      '${lesson.name}'`);
        await downloadLessonFile(lesson, theCourse);
        totalDownloaded++;
      } // lessons
    } // units
  } // levels

  writeDataFile();

  await browser.close();

  const mainEndTime = new Date();
  const mainDifference = mainEndTime - mainStartTime;
  console.log(`\n\nTotal Elapsed Time: ${mainDifference} (ms)`);
  console.log(`Total Lessons Downloaded: ${totalDownloaded}\n\n`);
}

main();
