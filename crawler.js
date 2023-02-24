/**
 * This puppeteer script crawls through a website and collects course, level, unit, and lesson information.
 */
require('dotenv').config();
const dateFormat = require('date-format');
const path = require('path');
const fs = require('fs');

const puppeteer = require('puppeteer');

let courses = [];

const courseUrlPrefix = 'https://yoyochinese.com/courses/';
const unitUrlPrefix = 'https://yoyochinese.com/unit/';
const lessonUrlPrefix = 'https://yoyochinese.com/lesson/';

let page = undefined;
let browser = undefined;

function createCourseFile(someCourse) {
  try {
    const mainCourseDir = path.join(__dirname, someCourse.downloadSubDir);
    const courseFullFilePath = path.join(
      mainCourseDir,
      `course_${dateTimeStringOfRun}.json`
    );
    let prettyData = JSON.stringify(someCourse, null, 2);
    fs.writeFileSync(courseFullFilePath, prettyData);
    console.log(`Created ${courseFullFilePath}`);
  } catch (error) {
    //console.log(error);
  }
}

function writeCourseFile(someCourse) {
  try {
    const mainCourseDir = path.join(__dirname, someCourse.downloadSubDir);
    const courseFullFilePath = path.join(
      mainCourseDir,
      `course_${dateTimeStringOfRun}.json`
    );
    let prettyData = JSON.stringify(someCourse, null, 2);
    fs.writeFileSync(courseFullFilePath, prettyData);
  } catch (error) {
    //console.log(error);
  }
}

function createDirectoryStructureForCourse(someCourse) {
  // we only want to create folder structures once
  if (createFolderStructure) {
    const subFolders = ['videos', 'mp3s', 'pdfs'];

    const directories = [];

    const mainCourseDir = path.join(__dirname, someCourse.downloadSubDir);

    for (const folderName of subFolders) {
      directories.push(path.join(mainCourseDir, folderName));
    }

    console.log(`\n\n`);
    let readmeFullFilePath = undefined;
    for (const directory of directories) {
      try {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`Created ${directory}`);
        // create a readme in each subfolder
        const segments = directory.split('\\');
        const folderName = segments[segments.length - 1];
        const readmeFileName = `${folderName}.md`;
        readmeFullFilePath = path.join(directory, readmeFileName);
        const readmeFileContent = `# ${folderName}\n\nThis folder contains the ${folderName} of the course.`;
        fs.writeFileSync(readmeFullFilePath, readmeFileContent);
        console.log(`Created ${readmeFullFilePath}`);
        //console.log('success');
      } catch (error) {
        //console.log(error);
        console.log(`Created ${readmeFullFilePath}`);
      }
    }
  }

  // we may only create folder structures once, but
  // we want to create a course file for every run
  createCourseFile(someCourse);
}

/**
 * This function takes in the source code of a page, and tries to find
 * a https://embed-ssl.wistia.com/deliveries/someUUID.bin within it.
 *
 * @param {*} pageSource
 * @returns
 */
function getVideoBinUrl(lessonPageSource) {
  let videoBinUrl = undefined;

  // // search source code of page for wistia url ending with .bin

  const lines = lessonPageSource.split('\n');

  //
  // look for line like this:
  // W.iframeInit({"assets":[{"type":"original","slug":"original","display_name":"Original File","details":{},"width":1280,"height":720,"size":241828093,"bitrate":6410,"public":true,"status":2,"progress":1.0,"url":"https://embed-ssl.wistia.com/deliveries/84e5ef06e84364d2c044d85842a07a3f.bin","created_at":1565125821},{"type":"iphone_video","slug":"mp4_h264_609k","display_name": ...
  //

  let foundString = undefined;
  for (const line of lines) {
    if (line.trim().startsWith('W.iframeInit(')) {
      foundString = line.trim();
      break;
    }
  }

  if (foundString) {
    let foundKeyValue = undefined;

    // the json settings are comma separated
    let linePortions = foundString.split(',');

    // look for this key value pair: "url":"https://embed-ssl.wistia.com/deliveries/someUUID.bin"
    for (const linePortion of linePortions) {
      if (
        linePortion.includes(`"https://embed-ssl.wistia.com/deliveries`) &&
        linePortion.includes(`"url"`)
      ) {
        foundKeyValue = linePortion;
        break;
      }
    }

    let jsonObject = undefined;
    if (foundKeyValue) {
      const tempJSONString = `{ ${foundKeyValue} }`;

      try {
        jsonObject = JSON.parse(tempJSONString);
      } catch (error) {
        console.log(
          `Error trying to create a json object with properties: '${foundKeyValue}'`
        );
      }
    }

    if (jsonObject && jsonObject.url) {
      videoBinUrl = jsonObject.url;
    }
  }

  return videoBinUrl;
}

/**
 * Given a long lesson name like
 * 'beginner-conversational-unit-36-lesson-3-Transportation-Part-2'
 * this function will return a shorter MP4 file name
 * like
 * 'BC-U36-L3-Transportation-Part-2.mp4
 * '
 * @param {*} longLessonName
 * @returns
 */
function getDesired_MP4_FileName(longLessonName) {
  return getDesiredFileName(longLessonName, '.mp4');
}

/**
 * Given a long lesson name like
 * 'beginner-conversational-unit-36-lesson-3-Transportation-Part-2'
 * this function will return a shorter PDF file name
 * like
 * 'BC-U36-L3-Transportation-Part-2.pdf
 * '
 * @param {*} longLessonName
 * @returns
 */
function getDesired_PDF_FileName(longLessonName) {
  return getDesiredFileName(longLessonName, '.pdf');
}

/**
 * Given a long lesson name like
 * 'beginner-conversational-unit-36-lesson-3-Transportation-Part-2'
 * this function will return a shorter MP3 file name
 * like
 * 'BC-U36-L3-Transportation-Part-2.mp3
 * '
 * @param {*} longLessonName
 * @returns
 */
function getDesired_MP3_FileName(longLessonName) {
  return getDesiredFileName(longLessonName, '.mp3');
}

/**
 * Generic function to take a long lesson name
 * and trim it down to a smaller name, and add a desired
 * file extension
 * @param {*} longLessonName
 * @param {*} extension ('.mp4','.pdf','.mp3')
 * @returns
 */
function getDesiredFileName(longLessonName, extension) {
  // 'beginner-conversational-unit-36-lesson-3-Transportation-Part-2'
  //  or
  //  'upper-intermediate-conversational-unit-3-lesson-1'

  let shortLessonFileName = undefined;

  if (longLessonName) {
    const unitIndex = longLessonName.toUpperCase().indexOf('UNIT');
    if (unitIndex !== -1) {
      // it likely follows this pattern *-unit-xx-lesson-yy-*

      //
      // use prefix when possible
      //
      let prefix = '';
      const uppercasedLongLessonName = longLessonName.toUpperCase();
      if (
        uppercasedLongLessonName.startsWith(
          'beginner-conversational'.toUpperCase()
        )
      ) {
        prefix = 'BC-';
      } else if (
        uppercasedLongLessonName.startsWith(
          'chinese-character-reader'.toUpperCase()
        )
      ) {
        prefix = 'CCR-';
      } else if (
        uppercasedLongLessonName.startsWith(
          'chinese-character-II'.toUpperCase()
        )
      ) {
        prefix = 'CC2-';
      } else if (
        uppercasedLongLessonName.startsWith('chinese-character'.toUpperCase())
      ) {
        prefix = 'CC-';
      } else if (
        uppercasedLongLessonName.startsWith(
          'intermediate-conversational'.toUpperCase()
        )
      ) {
        prefix = 'IC-';
      } else if (
        uppercasedLongLessonName.startsWith(
          'upper-intermediate-conversational'.toUpperCase()
        )
      ) {
        prefix = 'UIC-';
      }

      const index = longLessonName.toUpperCase().indexOf('UNIT');
      if (index !== -1) {
        // unit-36-lesson-3-Transportation-Part-2

        const segments = longLessonName.substring(index).split('-');
        segments[0] = segments[0].toUpperCase().replace('UNIT', 'U');
        segments[2] = segments[2].toUpperCase().replace('LESSON', 'L');

        // U36-L3
        let unitLesson =
          segments[0] + segments[1] + '-' + segments[2] + segments[3];

        const remainingSegments = [];
        for (let i = 4; i < segments.length; i++) {
          remainingSegments.push(segments[i]);
        } // for

        // Transportation-Part-2
        let friendlyDescription = '';
        // some lesson names don't have friendly portion
        if (remainingSegments.length > 0) {
          friendlyDescription = remainingSegments.join('-');
          unitLesson = unitLesson + '-'; // need a dash before friendly description
        }

        // BC-U36-L3-Transportation-Part-2.someExtension
        shortLessonFileName =
          prefix + unitLesson + friendlyDescription + extension;
      }
    } //if
    else {
      // doesn't follow the normal pattern.
      // perhaps : 'how-say-if-in-chinese' or 'How-to-Ask-Where-Questions-in-Chinese'
      shortLessonFileName = longLessonName + extension;
    }
  } // if

  return shortLessonFileName;
}

/**
 * Take a long unit name and returns a short name.
 * e.g. Takes in
 * 'beginner-conversational-unit-31-Talking-About-When'
 * and returns
 * 'unit-31-Talking-About-When'
 * @param {*} longUnitName
 * @returns
 */
function getShortUnitName(longUnitName) {
  let shortUnitName = longUnitName;

  if (longUnitName) {
    let index = longUnitName.toUpperCase().indexOf('UNIT');
    if (index !== -1) {
      // unit is in the name
      // e.g. beginner-conversational-unit-31-Talking-About-When
      shortUnitName = longUnitName.substring(index);
    }
  }

  return shortUnitName;
}

function getCourseFolderName(courseUrl) {
  return courseUrl.replace(courseUrlPrefix, '');
}

/**
 * Adds a course object to the courses array
 * @param {*} courseUrl
 * @returns course
 */
function addCourse(courseUrl, humanFriendlyName) {
  // e.g. https://yoyochinese.com/courses/beginner-conversational-chinese

  const courseName = getCourseFolderName(courseUrl);

  let someCourse = courses.find((course) => course.name === courseName);
  if (!someCourse) {
    someCourse = {
      name: courseName,
      humanFriendlyName: humanFriendlyName,
      url: courseUrl,
      downloadSubDir: `courses/${courseName}`,
      levels: [],
    };
    courses.push(someCourse);
    createDirectoryStructureForCourse(someCourse);
  }

  return someCourse;
}

function getCourseObjectsFromArrayOfFriendlyNames(friendlyCourseNames) {
  let foundCourses = [];

  if (friendlyCourseNames && friendlyCourseNames.length > 0) {
    for (const friendlyName of friendlyCourseNames) {
      let foundCourse = courses.find(
        (someCourse) => someCourse.humanFriendlyName === friendlyName
      );
      if (foundCourse) {
        foundCourses.push(foundCourse);
      } else {
        console.log(
          `Could not find a course with friendly name '${friendlyName}'`
        );
      }
    }
  }

  return foundCourses;
}

/**
 * Adds a level to a course, and returns the level object
 * @param {*} someCourse
 * @param {*} levelUrl
 */
function addLevelToCourse(someCourse, levelUrl) {
  let theLevel = undefined;

  //      level  : https://yoyochinese.com/courses/beginner-conversational-chinese (for level1)
  //      level  : https://yoyochinese.com/courses/beginner-conversational-chinese/2 (for level 2)

  if (someCourse) {
    // for levels, use the numbers at the end of the url
    const levelName = levelUrl.replace(courseUrlPrefix, '');
    const segments = levelName.split('/');
    const lastItem = segments[segments.length - 1];

    let levelValue = 0;
    if (isNaN(parseInt(lastItem))) {
      levelValue = 1;
    } else {
      levelValue = lastItem;
    }

    // composed level name
    const computedLevelName = `Level${levelValue}`;
    let someLevel = someCourse.levels.find(
      (level) => level.name === computedLevelName
    );
    if (!someLevel) {
      someLevel = {
        name: computedLevelName,
        url: levelUrl,
        units: [],
      };
      someCourse.levels.push(someLevel);
      theLevel = someLevel;
    }
  }

  return theLevel;
}

/**
 * Adds a unit to a level, and returns the unit object
 * @param {*} someLevel
 * @param {*} unitUrl
 */
function addUnitToLevel(someLevel, unitUrl) {
  let theUnit = undefined;

  //      unit  :     "https://yoyochinese.com/unit/beginner-conversational-unit-19-Siblings",

  if (someLevel) {
    // for units, just use their descript name in url
    const unitName = unitUrl.replace(unitUrlPrefix, '');
    let someUnit = someLevel.units.find((unit) => unit.name === unitName);
    if (!someUnit) {
      someUnit = {
        name: unitName,
        shortName: getShortUnitName(unitName),
        url: unitUrl,
        lessons: [],
      };
      someLevel.units.push(someUnit);
      theUnit = someUnit;
    }
  }

  return theUnit;
}

/**
 * Adds a lesson to a unit, and returns a lesson
 * @param {*} someUnit
 * @param {*} lessonUrl
 */
function addLessonToUnit(someUnit, lessonUrl) {
  let theLesson = undefined;
  //https://yoyochinese.com/chinese-learning-tools/Mandarin-Chinese-pronunciation-lesson/pinyin-chart-table"
  // https://yoyochinese.com/lesson
  if (someUnit) {
    // e.g. "https://yoyochinese.com/lesson/beginner-conversational-unit-60-lesson-2-Chinese-on-The-Street-More-on-Directions/dialogue"

    let lessonName = undefined;
    // this lesson appears a lot
    if (
      lessonUrl ===
      'https://yoyochinese.com/chinese-learning-tools/Mandarin-Chinese-pronunciation-lesson/pinyin-chart-table'
    ) {
      lessonName = lessonUrl.replace(
        'https://yoyochinese.com/chinese-learning-tools/',
        ''
      );
    } else {
      lessonName = lessonUrl.replace(lessonUrlPrefix, '');
      const segments = lessonName.split('/');
      lessonName = segments[0];
    }

    let someLesson = someUnit.lessons.find(
      (lesson) => lesson.name === lessonName
    );
    //dom here
    if (!someLesson) {
      someLesson = {
        name: lessonName,
        desiredMP4Name: getDesired_MP4_FileName(lessonName),
        url: lessonUrl,
        pdfUrl: undefined,
        desiredPDFName: undefined,
        mp3Url: undefined,
        desiredMP3Name: undefined,
      };
      someUnit.lessons.push(someLesson);
      theLesson = someLesson;
    }
  }

  return theLesson;
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function getCurrentPage() {
  return page.url();
}

const puppeteerIsHeadless = false;

let createFolderStructure = false;

const startDateTime = new Date();
let dateTimeStringOfRun = dateFormat(startDateTime);
dateTimeStringOfRun = dateTimeStringOfRun.replace(/\:/g, '_');
dateTimeStringOfRun = dateTimeStringOfRun.replace(/\./g, '_');
// const coursesFilename = path.join(
//   __dirname,
//   'courses',
//   `courses_${dateTimeStringOfRun}.json`
// );

async function main() {
  browser = await puppeteer.launch({ headless: puppeteerIsHeadless });

  page = await browser.newPage();

  // Set screen size
  await page.setViewport({ width: 1080, height: 1024 });

  //
  // log into website
  //
  await page.goto('https://yoyochinese.com/auth/login');
  await delay(1500);

  const userIdSelector = 'input.email-input';
  await page.waitForSelector(userIdSelector);

  const passwordSelector = 'input.password-input';
  await page.waitForSelector(passwordSelector);

  const myUserId = process.env.USER_NAME || '';
  const myPassword = process.env.USER_PASSWORD || '';

  await page.type(userIdSelector, myUserId, { delay: 100 });
  await page.type(passwordSelector, myPassword, { delay: 100 });

  await delay(1500);

  const loginButtonXPathSelector = `//span[text()="Login with Email"]`;
  await page.waitForXPath(loginButtonXPathSelector);

  // does not work

  // // await page.waitForXPath(loginButtonXPathSelector);
  // // await page.click(loginButtonXPathSelector);

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

  [button] = await page.$x(coursesXPathSelector);
  if (button) {
    await button.click();
  }

  await delay(1500);

  // figure out if we need to create folder structure for courses
  const CREATE_COURSES_FOLDER_STRUCTURE =
    process.env.CREATE_COURSES_FOLDER_STRUCTURE || 'false';
  createFolderStructure =
    CREATE_COURSES_FOLDER_STRUCTURE.trim().toLowerCase() === 'true';

  if (createFolderStructure) {
    console.log(`\n\nOpted TO create folder structures\n\n`);
  } else {
    console.log(`\n\nOpted NOT to create folder structures\n\n`);
  }

  //
  // Always read all available courses from website
  //
  const courseListXPathSelector = `//section[@class="course-cards"]/a[contains(@href,"/courses/")]`;
  await page.waitForXPath(courseListXPathSelector);

  let courseElements = await page.$x(courseListXPathSelector);

  for (const courseElement of courseElements) {
    const courseNameHumanFriendly = await page.evaluate(
      (el) => el.innerText,
      courseElement
    );
    const courseUrl = await page.evaluate((el) => el.href, courseElement);
    addCourse(courseUrl, courseNameHumanFriendly);
  }

  const COURSES_TO_PROCESS = process.env.COURSES_TO_PROCESS || '';
  const coursesToProcess = COURSES_TO_PROCESS.split(',');
  let blankCourseNamesEncountered = false;
  for (const courseToProcess of coursesToProcess) {
    if (courseToProcess.trim() === '') {
      blankCourseNamesEncountered = true;
      break;
    }
  } // for

  if (blankCourseNamesEncountered) {
    console.log(
      `\n\nNo course name(s) specified in COURSES_TO_PROCESS in .env file !!!!\n\n`
    );
    await browser.close();
    return;
  }

  const courseObjectsToProcess =
    getCourseObjectsFromArrayOfFriendlyNames(coursesToProcess);

  if (!courseObjectsToProcess || courseObjectsToProcess.length < 1) {
    console.log(`\n\nNo course objects to process\n\n`);
    await browser.close();
    return;
  }

  //
  // At this point, we have some courses to process
  //

  for (const someCourse of courseObjectsToProcess) {
    console.log(`\n\nProcessing course: '${someCourse.humanFriendlyName}'...`);
    await delay(1500);
    await page.goto(someCourse.url);
    await delay(1500);

    //
    // get all the level links the course
    //

    // dom here
    console.log(`Selector - looking for levels...`);

    let thisCourseHasLevels = false;
    const levelsXPathSelector = `//p[text()[contains(., "Level")]]`;
    try {
      await page.waitForXPath(levelsXPathSelector, {
        delay: 1000,
        timeout: 3000,
      });
      thisCourseHasLevels = true;
    } catch (e) {
      console.log(
        `Course ${someCourse.courseNameHumanFriendly} does not have levels!`
      );
      thisCourseHasLevels = false;
    }

    if (!thisCourseHasLevels) {
      //
      // the grammar series doesn't have levels :S
      //
      // create a fake level pointing its url to the course's url
      const imaginaryLevel = {
        name: 'Level1',
        url: someCourse.url,
        units: [],
      };
      someCourse.levels.push(imaginaryLevel);
    } else {
      //
      // n-1 courses from this website has levels in a course
      //

      let levelElements = await page.$x(levelsXPathSelector);
      console.log(` After Selector - looking for levels`);

      let levelUrl = undefined;
      for (const levelElement of levelElements) {
        await levelElement.click({ delay: 500 });
        await delay(500);
        levelUrl = getCurrentPage();
        addLevelToCourse(someCourse, levelUrl);
      } // loop through level elements
    }

    // loop through the levels of the course
    // to collect the units
    for (const someLevel of someCourse.levels) {
      console.log(`\nProcessing level: '${someLevel.name}'...`);

      await delay(500);

      // go to the level page
      await page.goto(someLevel.url);

      //
      // get unit hrefs of a given level
      //
      console.log(`Selector - looking for units...`);
      const unitSelector = 'a.icon-link';
      await page.waitForSelector(unitSelector, { delay: 500 });

      // get all the unit urls for the level
      const unitUrls = await page.$$eval(unitSelector, (elements) =>
        elements.map((element) => element.href)
      );

      console.log(`After Selector - looking for units`);

      // add units to the current level
      for (const unitUrl of unitUrls) {
        addUnitToLevel(someLevel, unitUrl);
      } // loop through unit urls

      // visit each unit page
      for (const someUnit of someLevel.units) {
        console.log(`\nProcessing unit: '${someUnit.name}'...`);
        await delay(500);
        // go to the unit page for this level
        await page.goto(someUnit.url);

        console.log(`Selector - looking for lessons...`);
        const lessonsXPathSelector = `//a[contains(@href,"lesson")]`;
        await page.waitForXPath(lessonsXPathSelector, { delay: 500 });
        console.log(`After Selector - looking for lessons`);
        let lessonElements = await page.$x(lessonsXPathSelector);

        for (const lessonElement of lessonElements) {
          const lessonUrl = await page.evaluate((el) => el.href, lessonElement);
          // ignore the pinyin chart, that link is from top toolbar and not a lesson
          if (
            lessonUrl !==
            'https://yoyochinese.com/chinese-learning-tools/Mandarin-Chinese-pronunciation-lesson/pinyin-chart-table'
          ) {
            addLessonToUnit(someUnit, lessonUrl);
          }
        } // loop through lessons

        for (const someLesson of someUnit.lessons) {
          console.log(`\nProcessing someLesson: '${someLesson.name}'...`);
          await delay(500);
          // go to the lesson page for this unit
          await page.goto(someLesson.url);

          //
          // See if lesson has a video
          //
          const videoSelector = 'iframe.wistia-embed';

          // not every lesson will have a video
          let processVideoUrl = false;
          try {
            console.log(`Selector - looking for wistia iframe...`);
            await page.waitForSelector(videoSelector, {
              delay: 1500,
              timeout: 3000,
            });
            processVideoUrl = true;
          } catch (e) {
            console.log(`Lesson ${someLesson.name} did not have a video!`);

            processVideoUrl = false;
          }

          console.log(`After Selector - looking for wistia iframe`);

          if (processVideoUrl) {
            let videoUrl = await page.$eval(
              videoSelector,
              (element) => element.src
            );

            // https://www.yeahhub.com/download-wistia-videos-without-tool/
            videoUrl = `${videoUrl}?videoFoam=true`;
            someLesson.videoUrl = videoUrl;
          }

          //
          // See if lesson has a PDF
          //
          await delay(500);

          console.log(`Selector - looking for Notes tab...`);
          const notesTabXPathSelector = `//a[text()[contains(., "Notes")]]`;
          let notesTabElements = await page.$x(notesTabXPathSelector);

          console.log(`After Selector - looking for Notes tab`);
          if (notesTabElements && notesTabElements.length == 1) {
            //
            // Click on the 'Notes' tab of the lesson
            //

            const notesTabElement = notesTabElements[0];
            await notesTabElement.click({ delay: 500 });

            //
            // Now look for the download lecture notes anchor
            //
            await delay(500);

            console.log(`Selector - looking for Download Notes link...`);
            const downloadNotesXPathSelector = `//a[./p[contains(text(),"Download Lecture Notes")]]`;

            // there should just be 1 "Download Lecture Notes" link
            let downloadNotesElements = await page.$x(
              downloadNotesXPathSelector
            );
            console.log(`After Selector - looking for Download Notes link`);
            if (downloadNotesElements && downloadNotesElements.length == 1) {
              const downloadNotesElement = downloadNotesElements[0];
              const pdfUrl = await page.evaluate(
                (el) => el.href,
                downloadNotesElement
              );
              someLesson.pdfUrl = pdfUrl;
              someLesson.desiredPDFName = getDesired_PDF_FileName(
                someLesson.name
              );
            }
          } // there was a notes tab

          //
          // See if lesson has an MP3
          //
          await delay(500);

          console.log(`Selector - looking for Audio tab...`);
          // there should just be 1 "Audio" tab (If there is a PDF to download)
          const audioTabXPathSelector = `//a[text()[contains(., "Audio")]]`;
          let audioTabElements = await page.$x(audioTabXPathSelector);
          console.log(`After Selector - looking for Audio tab`);
          if (audioTabElements && audioTabElements.length == 1) {
            //
            // Click on the 'Audio' tab of the lesson
            //

            const audioTabElement = audioTabElements[0];
            await audioTabElement.click({ delay: 500 });

            //
            // Now look for the download audio anchor
            //
            console.log(`Selector - looking for Download Audio link...`);
            const downloadAudioXPathSelector = `//a[./span[contains(text(),"Download Audio")]]`;

            // there should just be 1 "Download Audio" link
            let downloadAudioElements = await page.$x(
              downloadAudioXPathSelector
            );
            console.log(`After Selector - looking for Download Audio link`);
            if (downloadAudioElements && downloadAudioElements.length == 1) {
              const downloadAudioElement = downloadAudioElements[0];
              const mp3Url = await page.evaluate(
                (el) => el.href,
                downloadAudioElement
              );
              someLesson.mp3Url = mp3Url;
              someLesson.desiredMP3Name = getDesired_MP3_FileName(
                someLesson.name
              );
            }
          } // there was an audio tab
        } // looping through lessons

        // need to open video lesson page with '?videoFoam=true'
        for (const someLesson of someUnit.lessons) {
          console.log(`\nProcessing someLesson #2: '${someLesson.name}'...`);
          if (someLesson.videoUrl) {
            await page.goto(someLesson.videoUrl);

            await delay(1000);

            // need to figure out hidden UUID.bin file name
            // hidden in the page's source code
            const lessonPageSource = await page.content();
            const videoBinUrl = getVideoBinUrl(lessonPageSource);
            if (videoBinUrl) {
              someLesson.videoBinUrl = videoBinUrl;
            }
          }
        } // loop through lessons
      } // loop through unit urls
    } // loop through levels

    // write out the info collected on the course
    writeCourseFile(someCourse);
  } // loop through courses

  // temp: write out all info collected
  console.log(JSON.stringify(courses, null, 2));

  await browser.close();

  const endDateTime = new Date();
  const mainDifference = endDateTime - startDateTime;

  console.log(`\n\nTotal Elapsed Time: ${mainDifference} (ms)`);
}

main();
