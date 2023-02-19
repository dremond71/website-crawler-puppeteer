/**
 * This puppeteer script crawls through a website and collects course, level, unit, and lesson information.
 */

const puppeteer = require('puppeteer');

let courses = [];

const courseUrlPrefix = 'https://yoyochinese.com/courses/';
const unitUrlPrefix = 'https://yoyochinese.com/unit/';
const lessonUrlPrefix = 'https://yoyochinese.com/lesson/';

let page = undefined;
let browser = undefined;

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
function getDesiredMP4FileName(longLessonName) {
  // 'beginner-conversational-unit-36-lesson-3-Transportation-Part-2'

  let shortLessonFileName = undefined;

  if (longLessonName) {
    let prefix = '';
    if (longLessonName.toUpperCase().startsWith('BEGINNER-CONVERSATIONAL-')) {
      prefix = 'BC-';
    }

    const index = longLessonName.toUpperCase().indexOf('UNIT');
    if (index !== -1) {
      // unit-36-lesson-3-Transportation-Part-2

      const segments = longLessonName.substring(index).split('-');
      segments[0] = segments[0].toUpperCase().replace('UNIT', 'U');
      segments[2] = segments[2].toUpperCase().replace('LESSON', 'L');

      // U36-L3
      const unitLesson =
        segments[0] + segments[1] + '-' + segments[2] + segments[3] + '-';

      const remainingSegments = [];
      for (let i = 4; i < segments.length; i++) {
        remainingSegments.push(segments[i]);
      } // for

      // Transportation-Part-2
      const nameOfLesson = remainingSegments.join('-');

      // BC-U36-L3-Transportation-Part-2.mp4
      shortLessonFileName = prefix + unitLesson + nameOfLesson + '.mp4';
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

/**
 * Adds a course object to the courses array
 * @param {*} courseUrl
 * @returns course
 */
function addCourse(courseUrl) {
  // e.g. https://yoyochinese.com/courses/beginner-conversational-chinese

  const courseName = courseUrl.replace(courseUrlPrefix, '');

  let someCourse = courses.find((course) => course.name === courseName);
  if (!someCourse) {
    someCourse = {
      name: courseName,
      url: courseUrl,
      levels: [],
    };
    courses.push(someCourse);
  }

  return someCourse;
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
    if (!someLesson) {
      someLesson = {
        name: lessonName,
        desiredMP4Name: getDesiredMP4FileName(lessonName),
        url: lessonUrl,
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

  //
  // Click on Beginner Conversational Course
  //

  /*
  <a class="sc-iAvgwm bZPVWR" href="/courses/beginner-conversational-chinese" style="background: rgb(0, 181, 167);"><img src="/public/1d9adb40ad1310332aa3.png"><h2>Beginner Conversational</h2></a>
  */

  const beginnerConversationalCourseSelector =
    'a[href="/courses/beginner-conversational-chinese"]';
  await page.waitForSelector(beginnerConversationalCourseSelector);

  await page.click(beginnerConversationalCourseSelector, { delay: 1000 });

  //
  // get all the level links of beginner course
  //

  const levelsXPathSelector = `//p[text()[contains(., "Level")]]`;
  await page.waitForXPath(levelsXPathSelector, { delay: 1000 });

  // good time to get url for course.
  // should be on page for beginner conversational level 1
  let someCourse = addCourse(getCurrentPage());

  let levelElements = await page.$x(levelsXPathSelector);

  let levelUrl = undefined;
  for (const levelElement of levelElements) {
    await levelElement.click({ delay: 500 });
    await delay(500);
    levelUrl = getCurrentPage();
    addLevelToCourse(someCourse, levelUrl);
  } // loop through level elements

  // loop through the levels of the course
  // to collect the units
  for (const someLevel of someCourse.levels) {
    await delay(500);

    // go to the level page
    await page.goto(someLevel.url);

    //
    // get unit hrefs of a given level
    //
    const unitSelector = 'a.icon-link';
    await page.waitForSelector(unitSelector, { delay: 500 });

    // get all the unit urls for the level
    const unitUrls = await page.$$eval(unitSelector, (elements) =>
      elements.map((element) => element.href)
    );

    // add units to the current level
    for (const unitUrl of unitUrls) {
      addUnitToLevel(someLevel, unitUrl);
    } // loop through unit urls

    // visit each unit page
    for (const someUnit of someLevel.units) {
      await delay(500);
      // go to the unit page for this level
      await page.goto(someUnit.url);

      const lessonsXPathSelector = `//a[contains(@href,"lesson")]`;
      await page.waitForXPath(lessonsXPathSelector, { delay: 500 });
      let lessonElements = await page.$x(lessonsXPathSelector);

      //console.log(`lesson count: ${lessonElements.length}`);
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
        await delay(500);
        // go to the lesson page for this unit
        await page.goto(someLesson.url);

        const videoSelector = 'iframe.wistia-embed';

        // not every lesson will have a video
        let processVideoUrl = false;
        try {
          await page.waitForSelector(videoSelector, {
            delay: 1500,
            timeout: 3000,
          });
          processVideoUrl = true;
        } catch (e) {
          console.log(`Lesson ${someLesson.name} did not have a video!`);

          processVideoUrl = false;
        }

        if (processVideoUrl) {
          let videoUrl = await page.$eval(
            videoSelector,
            (element) => element.src
          );

          // https://www.yeahhub.com/download-wistia-videos-without-tool/
          videoUrl = `${videoUrl}?videoFoam=true`;
          someLesson.videoUrl = videoUrl;
        }
      }

      // need to open video lesson page with '?videoFoam=true'
      for (const someLesson of someUnit.lessons) {
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

  console.log(JSON.stringify(courses, null, 2));

  await browser.close();
}

main();
