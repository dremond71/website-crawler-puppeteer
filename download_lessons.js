require('dotenv').config();

const puppeteer = require('puppeteer');
const fs = require('fs');

const stream = require('stream');
const axios = require('axios');
const util = require('util');
const pipeline = util.promisify(stream.pipeline);

const getMP3Duration = require('get-mp3-duration');

const path = require('path');
const { getVideoDurationInSeconds } = require('get-video-duration');

let courseFileName = undefined;

let page = undefined;
let browser = undefined;
let totalVideosDownloaded = 0;
let totalPDFsDownloaded = 0;
let totalMP3sDownloaded = 0;

async function getMediaFileLengthHumanFriendly(seconds) {
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

function setLessonVideoAsNotDownloaded(someLesson, someCourse) {
  someLesson.videoLengthInSeconds = 0;
  someLesson.videoLengthHumanFriendly = '';
  someLesson.videoDownloaded = false;
  someLesson.videoDownloadDurationInMilliseconds = 0;

  // cleanup files in videos directory
  deleteLessonDownloadedVideoFiles(someLesson, someCourse);
}

function deleteLessonDownloadedVideoFiles(someLesson, someCourse) {
  let downloadDirectoryForVideos = getCourseVideosDirectoryFullPath(someCourse);
  let binFileName = getBinFileName(someLesson);
  let binFilePath = path.join(downloadDirectoryForVideos, binFileName);
  let mp4FilePath = path.join(
    downloadDirectoryForVideos,
    someLesson.desiredMP4Name
  );

  try {
    fs.rmSync(binFilePath);
  } catch (error) {}

  try {
    fs.rmSync(mp4FilePath);
  } catch (error) {}
}

function setLessonPDFAsNotDownloaded(someLesson, someCourse) {
  someLesson.pdfDownloaded = false;

  // cleanup file in pdfs directory
  deleteLessonDownloadedPDFFile(someLesson, someCourse);
}

function deleteLessonDownloadedPDFFile(someLesson, someCourse) {
  if (someLesson.desiredPDFName && someLesson.desiredPDFName.trim() != '') {
    let downloadDirectoryForPDFs = getCoursePDFsDirectoryFullPath(someCourse);
    let pdfFilePath = path.join(
      downloadDirectoryForPDFs,
      someLesson.desiredPDFName
    );

    try {
      fs.rmSync(pdfFilePath);
    } catch (error) {}
  } //if
}

function setLessonMP3AsNotDownloaded(someLesson, someCourse) {
  someLesson.mp3LengthInSeconds = 0;
  someLesson.mp3LengthHumanFriendly = '';
  someLesson.mp3Downloaded = false;
  someLesson.mp3DownloadDurationInMilliseconds = 0;

  // cleanup file in mp3s directory
  deleteLessonDownloadedMP3File(someLesson, someCourse);
}

function deleteLessonDownloadedMP3File(someLesson, someCourse) {
  if (someLesson.desiredMP3Name && someLesson.desiredMP3Name.trim() != '') {
    let downloadDirectoryForMP3s = getCourseMP3sDirectoryFullPath(someCourse);
    let mp3FilePath = path.join(
      downloadDirectoryForMP3s,
      someLesson.desiredMP3Name
    );

    try {
      fs.rmSync(mp3FilePath);
    } catch (error) {}
  } //if
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
    let prettyData = JSON.stringify(theCourse, null, 2);
    fs.writeFileSync(courseFileName, prettyData);
  } catch (error) {
    console.log(`Error saving data file`);
  }
}

function getCourseVideosDirectoryFullPath(theCourse) {
  return path.join(getCourseDirectoryFullPath(theCourse), 'videos');
}

function getCourseMP3sDirectoryFullPath(theCourse) {
  return path.join(getCourseDirectoryFullPath(theCourse), 'mp3s');
}

function getCoursePDFsDirectoryFullPath(theCourse) {
  return path.join(getCourseDirectoryFullPath(theCourse), 'pdfs');
}

function getCourseDirectoryFullPath(theCourse) {
  return path.join(__dirname, theCourse.downloadSubDir);
}

function videoNotDownloaded(someLesson) {
  return (
    someLesson['videoDownloaded'] == undefined ||
    someLesson.videoDownloaded === false
  );
}

function mp3NotDownloaded(someLesson) {
  return (
    someLesson['mp3Downloaded'] == undefined ||
    someLesson.mp3Downloaded === false
  );
}

function pdfNotDownloaded(someLesson) {
  return (
    someLesson['pdfDownloaded'] == undefined ||
    someLesson.pdfDownloaded === false
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
 * This function downloads a lesson's video file.
 *
 * It does not use any puppeteer approaches since doing this
 * via the UI failed to work consistently.
 *
 */
async function downloadLessonVideo(theLesson, theCourse) {
  const downloadDirectory = getCourseVideosDirectoryFullPath(theCourse);
  //
  // only download a lesson file, if it has not already been downloaded
  //

  if (theLesson.videoBinUrl && videoNotDownloaded(theLesson)) {
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
        let lengthInSeconds = 0;
        try {
          lengthInSeconds = await getVideoDurationInSeconds(newFilePath);
          theLesson.videoLengthInSeconds = lengthInSeconds;
          theLesson.videoLengthHumanFriendly =
            await getMediaFileLengthHumanFriendly(lengthInSeconds);
          theLesson.videoDownloaded = true;
          totalVideosDownloaded++;
        } catch (error) {
          console.log(
            `Error getting length of file : ${theLesson.desiredMP4Name}`
          );
        }

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
        setLessonVideoAsNotDownloaded(theLesson, theCourse);
      }
    } else {
      setLessonVideoAsNotDownloaded(theLesson, theCourse);
    }
  } else {
    console.log('        skipping. File already downloaded.');
  }
  // write to file on each lesson downloaded to save state.
  // sometimes a windows machine likes to reboot for an update
  // for no particular reason.

  writeDataFile();
}

/**
 *
 * This function downloads a lesson's MP3 file.
 */
async function downloadLessonMP3(theLesson, theCourse) {
  // some lessons may not have an MP3 file, so skip download
  if (!theLesson.mp3Url || theLesson.mp3Url.trim() == '') {
    console.log('        skipping. No MP3 file available.');
    return;
  }

  const downloadDirectory = getCourseMP3sDirectoryFullPath(theCourse);
  //
  // only download a lesson mp3 file, if it has not already been downloaded
  //

  if (theLesson.mp3Url && mp3NotDownloaded(theLesson)) {
    const startTime = new Date();

    const downloadedFileNameWithMP3Extension = theLesson.desiredMP3Name;

    let downloadedFilePath = path.join(
      downloadDirectory,
      downloadedFileNameWithMP3Extension
    );

    console.log(`        Downloading lesson MP3 '${theLesson.mp3Url}'...}`);

    try {
      const request = await axios.get(theLesson.mp3Url, {
        responseType: 'stream',
      });

      await pipeline(request.data, fs.createWriteStream(downloadedFilePath));
      console.log(`        download succeeded :)`);
    } catch (error) {
      console.log(`        download failed :(`);
    }

    const fileDoesExist = fileExists(downloadedFilePath);

    if (fileDoesExist) {
      const buffer = fs.readFileSync(downloadedFilePath);
      let durationInMs = 0;
      try {
        durationInMs = getMP3Duration(buffer);
        const lengthInSeconds = durationInMs / 1000;
        theLesson.mp3LengthInSeconds = lengthInSeconds;
        theLesson.mp3LengthHumanFriendly =
          await getMediaFileLengthHumanFriendly(lengthInSeconds);
        theLesson.mp3Downloaded = true;
        totalMP3sDownloaded++;
      } catch (error) {}
      const endTime = new Date();
      const differenceInMilliseconds = endTime - startTime;
      theLesson.mp3DownloadDurationInMilliseconds = differenceInMilliseconds;
      console.log(
        `        Download duration: ${theLesson.mp3DownloadDurationInMilliseconds} (ms)\n`
      );
    } else {
      setLessonMP3AsNotDownloaded(theLesson, theCourse);
    }
  } else {
    console.log('        skipping. File already downloaded.');
  }
  // write to file on each lesson downloaded to save state.
  // sometimes a windows machine likes to reboot for an update
  // for no particular reason.

  writeDataFile();
}

function hasVideoUrl(someLesson) {
  return someLesson.videoBinUrl && someLesson.videoBinUrl.trim() !== '';
}

function hasPDFUrl(someLesson) {
  return someLesson.pdfUrl && someLesson.pdfUrl.trim() !== '';
}

function hasMP3Url(someLesson) {
  return someLesson.mp3Url && someLesson.mp3Url.trim() !== '';
}

/**
 *
 * This function downloads a lesson's PDF file.
 */
async function downloadLessonPDF(theLesson, theCourse) {
  // some lessons may not have a PDF file, so skip download
  if (!theLesson.pdfUrl || theLesson.pdfUrl.trim() == '') {
    console.log('        skipping. No PDF file available.');
    return;
  }

  const downloadDirectory = getCoursePDFsDirectoryFullPath(theCourse);
  //
  // only download a lesson pdf file, if it has not already been downloaded
  //

  if (theLesson.pdfUrl && pdfNotDownloaded(theLesson)) {
    const downloadedFileNameWithPDFExtension = theLesson.desiredPDFName;

    let downloadedFilePath = path.join(
      downloadDirectory,
      downloadedFileNameWithPDFExtension
    );

    console.log(`        Downloading lesson PDF '${theLesson.pdfUrl}'...}`);

    try {
      const request = await axios.get(theLesson.pdfUrl, {
        responseType: 'stream',
      });

      await pipeline(request.data, fs.createWriteStream(downloadedFilePath));
      const fileDoesExist = fileExists(downloadedFilePath);

      if (fileDoesExist) {
        theLesson.pdfDownloaded = true;
        totalPDFsDownloaded++;
      } else {
        setLessonPDFAsNotDownloaded(theLesson, theCourse);
      }
      console.log(`        download succeeded :)`);
    } catch (error) {
      console.log(`        download failed :(`);
    }
  } else {
    console.log('        skipping. File already downloaded.');
  }
  // write to file on each lesson downloaded to save state.
  // sometimes a windows machine likes to reboot for an update
  // for no particular reason.

  writeDataFile();
}

function displayFileTypeTotals() {
  console.log(`\n\n`);
  console.log(`Total Lesson Video urls : ${actualVideoTotal}`);
  console.log(`Total Lesson MP3 urls: ${actualMP3Total}`);
  console.log(`Total Lesson PDF urls: ${actualPDFTotal}`);
  console.log(`\n\n`);
}

function displayProgressOfDownloads() {
  console.log(`\n\n`);
  console.log(
    `Total Lesson Videos Downloaded So Far: ${totalVideosDownloaded}/${actualVideoTotal}`
  );
  console.log(
    `Total Lesson MP3s Downloaded So Far: ${totalMP3sDownloaded}/${actualMP3Total}`
  );
  console.log(
    `Total Lesson PDFs Downloaded So Far: ${totalPDFsDownloaded}/${actualPDFTotal}`
  );
  console.log(`\n\n`);
}

const puppeteerIsHeadless = false;

let actualVideoTotal = 0;
let actualMP3Total = 0;
let actualPDFTotal = 0;
let theCourse = undefined;
let maxVideosToDownload = 0;

async function main() {
  //
  // pull in environment variables
  //

  courseFileName = process.env.COURSE_TO_PROCESS || '';

  if (!courseFileName || courseFileName.trim() === '') {
    console.log(`Error: COURSE_TO_PROCESS is not specified in .env file`);
    return;
  }

  const fullPathToCourseFileName = path.join(__dirname, courseFileName);
  if (!fileExists(fullPathToCourseFileName)) {
    console.log(`Error: File '${fullPathToCourseFileName}' does not exist!`);
    return;
  } //if

  const PERFORM_VIDEOS_CLEANUP = process.env.PERFORM_VIDEOS_CLEANUP || 'false';
  const PERFORM_VIDEOS_DOWNLOAD =
    process.env.PERFORM_VIDEOS_DOWNLOAD || 'false';

  const PERFORM_PDFS_CLEANUP = process.env.PERFORM_PDFS_CLEANUP || 'false';
  const PERFORM_PDFS_DOWNLOAD = process.env.PERFORM_PDFS_DOWNLOAD || 'false';

  const PERFORM_MP3S_CLEANUP = process.env.PERFORM_MP3S_CLEANUP || 'false';
  const PERFORM_MP3S_DOWNLOAD = process.env.PERFORM_MP3S_DOWNLOAD || 'false';

  // boolean flags depending on values of environment variables
  const performVideosCleanUp =
    PERFORM_VIDEOS_CLEANUP.trim().toLowerCase() === 'true';
  const performVideosDownloads =
    PERFORM_VIDEOS_DOWNLOAD.trim().toLowerCase() === 'true';

  const performPDFsCleanUp =
    PERFORM_PDFS_CLEANUP.trim().toLowerCase() === 'true';
  const performPDFsDownloads =
    PERFORM_PDFS_DOWNLOAD.trim().toLowerCase() === 'true';

  const performMP3sCleanUp =
    PERFORM_MP3S_CLEANUP.trim().toLowerCase() === 'true';
  const performMP3sDownloads =
    PERFORM_MP3S_DOWNLOAD.trim().toLowerCase() === 'true';

  const mainStartTime = new Date();

  // read in a course file
  theCourse = require(courseFileName);

  const doingSomeCleanup =
    performVideosCleanUp || performMP3sCleanUp || performPDFsCleanUp;

  if (doingSomeCleanup) {
    console.log(`\n\nCleanup actions specified\n\n`);
    for (const level of theCourse.levels) {
      for (const unit of level.units) {
        for (const lesson of unit.lessons) {
          // cleaning up videos
          if (performVideosCleanUp) {
            setLessonVideoAsNotDownloaded(lesson, theCourse);
          }
          // cleaing up mp3s
          if (performMP3sCleanUp) {
            setLessonMP3AsNotDownloaded(lesson, theCourse);
          }
          // cleaing up pdfs
          if (performPDFsCleanUp) {
            setLessonPDFAsNotDownloaded(lesson, theCourse);
          }
        } // lessons
      } // units
    } // levels

    writeDataFile();
  } else {
    console.log(`\n\nNo cleanup actions specified\n\n`);
  }

  //
  // Get totals
  //

  for (const level of theCourse.levels) {
    for (const unit of level.units) {
      for (const lesson of unit.lessons) {
        if (hasVideoUrl(lesson)) {
          actualVideoTotal++;
        }
        if (hasMP3Url(lesson)) {
          actualMP3Total++;
        }
        if (hasPDFUrl(lesson)) {
          actualPDFTotal++;
        }
      } // lessons
    } // units
  } // levels

  displayFileTypeTotals();

  //
  // High definition videos take up a lot of space on a hard drive.
  // I don't have code in place to detect the amount of free space
  // on the hard drive, so instead I'll let user decide on setting
  // the number of files to download before it stops.
  // This way, the user can copy files over to an external hard drive,
  // clear out the video files in the repo directory on disk,
  // and download the next batch of video files
  //

  // empty string means no max
  const MAX_VIDEOS_TO_DOWNLOAD =
    process.env.MAX_VIDEOS_TO_DOWNLOAD.trim() || '';

  if (MAX_VIDEOS_TO_DOWNLOAD == '') {
    maxVideosToDownload = 10000;
    console.log(`\n\nNo limits set on maximum video downloads!\n\n`);
  } else {
    const maybeAnInt = parseInt(MAX_VIDEOS_TO_DOWNLOAD);
    if (isNaN(maybeAnInt)) {
      console.log(
        `Error: MAX_VIDEOS_TO_DOWNLOAD value of '${MAX_VIDEOS_TO_DOWNLOAD}' is not an integer`
      );
      return;
    } else {
      maxVideosToDownload = maybeAnInt;
      console.log(
        `\n\nLimit of '${maxVideosToDownload}' set on video downloads!\n\n`
      );
    }
  }

  //
  // Perform downloads
  //

  const doingSomeDownloads =
    performVideosDownloads || performMP3sDownloads || performPDFsDownloads;
  if (!doingSomeDownloads) {
    console.log(`\n\nNo download actions specified!\n\n`);
    return;
  }

  console.log(`\n\nDownload actions specified!\n\n`);

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
      // dom here
      await page.goto(unit.url);
      console.log(`\n    '${unit.shortName}'\n`);
      await delay(1500);

      for (const lesson of unit.lessons) {
        console.log(`      '${lesson.name}'`);

        if (performVideosDownloads) {
          if (totalVideosDownloaded < maxVideosToDownload) {
            await delay(1000);
            await downloadLessonVideo(lesson, theCourse);
          } else {
            console.log(
              `Skipping video file download because limit of ${maxVideosToDownload} has been reached`
            );
          }
        }

        if (performMP3sDownloads) {
          await delay(1000);
          await downloadLessonMP3(lesson, theCourse);
        }

        if (performPDFsDownloads) {
          await delay(1000);
          await downloadLessonPDF(lesson, theCourse);
        }

        displayProgressOfDownloads();
      } // lessons
    } // units
  } // levels

  writeDataFile();

  await browser.close();

  const mainEndTime = new Date();
  const mainDifference = mainEndTime - mainStartTime;

  console.log(`\n\nTotal Elapsed Time: ${mainDifference} (ms)`);
  console.log(`Total Lesson Videos Downloaded: ${totalVideosDownloaded}`);
  console.log(`Total Lesson PDFs   Downloaded: ${totalPDFsDownloaded}`);
  console.log(`Total Lesson MP3s   Downloaded: ${totalMP3sDownloaded}\n\n`);
}

main();
