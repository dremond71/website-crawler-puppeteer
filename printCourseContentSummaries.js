/**
 * This utility prints out a summary of all the
 * course MP4, MP3, and PDF files.
 */
require('dotenv').config();
const fs = require('fs');

const getMP3Duration = require('get-mp3-duration');
const path = require('path');
const { getVideoDurationInSeconds } = require('get-video-duration');

function getHumanFriendlySize(size) {
  var sizes = [
    ' Bytes',
    ' KB',
    ' MB',
    ' GB',
    ' TB',
    ' PB',
    ' EB',
    ' ZB',
    ' YB',
  ];

  for (var i = 1; i < sizes.length; i++) {
    if (size < Math.pow(1024, i))
      return (
        Math.round((size / Math.pow(1024, i - 1)) * 100) / 100 + sizes[i - 1]
      );
  }
  return size;
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

function getDirectories(someDirectoryPath) {
  const someDirectories = fs
    .readdirSync(someDirectoryPath, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  return someDirectories;
}

function getFiles(someDirectoryPath) {
  const someFiles = fs
    .readdirSync(someDirectoryPath, { withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => item.name);
  return someFiles;
}

function getNamesOfAllFileTypes(someCourse) {
  const namesOfTypes = {
    videos: [],
    pdfs: [],
    mp3s: [],
  };

  for (const level of someCourse.levels) {
    for (const unit of level.units) {
      for (const lesson of unit.lessons) {
        if (lesson.desiredMP4Name) {
          namesOfTypes['videos'].push(lesson.desiredMP4Name);
        }
        if (lesson.desiredPDFName) {
          namesOfTypes['pdfs'].push(lesson.desiredPDFName);
        }

        if (lesson.desiredMP3Name) {
          namesOfTypes['mp3s'].push(lesson.desiredMP3Name);
        }
      } // lessons
    } // units
  } // levels

  return namesOfTypes;
}
function getCourseObject(directoryFullPath) {
  let courseObject = undefined;

  const someFileNames = getFiles(directoryFullPath);
  const jsonFileNames = someFileNames.filter((fileName) => {
    return fileName.toLowerCase().endsWith('.json');
  });

  if (jsonFileNames && jsonFileNames.length > 0) {
    // there should just be 1 json course file
    const jsonFileName = jsonFileNames[0];

    let fileData = require(`${path.join(directoryFullPath, jsonFileName)}`);
    // check for fields that identify json file as a course file
    if (
      fileData.name &&
      fileData.humanFriendlyName &&
      fileData.downloadSubDir &&
      fileData.levels
    ) {
      courseObject = fileData;
      // won't be saved...just temporary for analysis of its directories
      courseObject.fullDirectoryPath = directoryFullPath;
    } else {
      fileData = undefined;
    }
  }

  return courseObject;
}

function getHoursText(hours) {
  return hours > 1 ? `${hours} hours` : `${hours} hour`;
}
function getMinutesText(minutes) {
  return minutes > 1 ? ` ${minutes} minutes` : ` ${minutes} minute`;
}
function getSecondsText(seconds) {
  return seconds > 1 ? ` ${seconds} seconds` : ` ${seconds} second`;
}

function getMediaFileDurationHumanFriendly(seconds) {
  if (seconds == 0) {
    return '0 seconds';
  }

  const MINUTE = 60;
  const HOUR = MINUTE * 60;

  let humanFriendlyDuration = '';

  let hourPortion = '';
  let minutePortion = '';
  let secondsPortion = '';

  let hours = Math.floor(seconds / HOUR);

  if (hours > 0) {
    hourPortion = `${getHoursText(hours)}`;

    // at least one hour
    let extraSeconds = seconds % HOUR;

    let minutes = Math.floor(extraSeconds / MINUTE);
    let extraSeconds2 = extraSeconds % MINUTE;

    if (minutes > 0) {
      // at least 1 minute

      minutePortion = `${getMinutesText(minutes)}`;

      if (extraSeconds2 > 0) {
        secondsPortion = `${getSecondsText(extraSeconds2)}`;
      }
    } else {
      // less than a minute

      if (extraSeconds2 > 0) {
        secondsPortion = `${getSecondsText(extraSeconds2)}`;
      }
    }
  } else {
    // less than an hour
    let minutes = Math.floor(seconds / MINUTE);
    let extraSeconds2 = seconds % MINUTE;

    if (minutes > 0) {
      // at least 1 minute

      minutePortion = `${getMinutesText(minutes)}`;

      if (extraSeconds2 > 0) {
        secondsPortion = `${getSecondsText(extraSeconds2)}`;
      }
    } else {
      // less than a minute
      if (extraSeconds2 > 0) {
        secondsPortion = `${getSecondsText(extraSeconds2)}`;
      }
    }
  }

  humanFriendlyDuration = hourPortion + minutePortion + secondsPortion;

  return humanFriendlyDuration.trim();
}

async function main() {
  const startDateTime = new Date();

  let coursesMainDir = process.env.COURSE_SUMMARY_MAIN_DIR.trim() || '';

  if (coursesMainDir == '') {
    coursesMainDir = path.join(__dirname, 'courses');
  }

  const COURSE_SUMMARY_INCLUDE_FILE_DETAILS =
    process.env.COURSE_SUMMARY_INCLUDE_FILE_DETAILS.trim() || '';
  const printFileDetails =
    COURSE_SUMMARY_INCLUDE_FILE_DETAILS.toLowerCase() == 'true';

  //
  // Look in top directories for a courses file
  //
  const someDirectories = getDirectories(coursesMainDir);

  let coursesFound = [];
  for (const someSubDir of someDirectories) {
    const subDirFullPath = path.join(coursesMainDir, someSubDir);
    const foundCourse = getCourseObject(subDirFullPath);
    if (foundCourse) {
      coursesFound.push(foundCourse);
    }
  }

  console.log(`\nFound ${coursesFound.length} courses in ${coursesMainDir}\n`);

  let totalMP4Files = 0;
  let totalPDFFiles = 0;
  let totalMP3Files = 0;

  let totalMP4FileBytes = 0;
  let totalPDFFileBytes = 0;
  let totalMP3FileBytes = 0;

  let totalMP4DurationInSeconds = 0;
  let totalMP3DurationInSeconds = 0;

  for (const course of coursesFound) {
    let courseTotalMP4FilesConfirmed = 0;
    let courseTotalPDFFilesConfirmed = 0;
    let courseTotalMP3FilesConfirmed = 0;

    let courseTotalMP4FileBytes = 0;
    let courseTotalPDFFileBytes = 0;
    let courseTotalMP3FileBytes = 0;

    let courseTotalMP4DurationInSeconds = 0;
    let courseTotalMP3DurationInSeconds = 0;

    console.log(
      `\n\n  '${course.humanFriendlyName}' in directory '${course.name}'`
    );
    const courseContentFileNames = getNamesOfAllFileTypes(course);

    const mp4FileNames = courseContentFileNames['videos'];
    const pdfFileNames = courseContentFileNames['pdfs'];
    const mp3FileNames = courseContentFileNames['mp3s'];

    //
    // MP4 files
    //

    console.log(`\n    has ${mp4FileNames.length} MP4 files\n`);

    for (const someMP4FileName of mp4FileNames) {
      const mp4FullFilePath = path.join(
        coursesMainDir,
        course.name,
        'videos',
        someMP4FileName
      );
      if (fileExists(mp4FullFilePath)) {
        let fileByteSize = 0;
        try {
          const stats = fs.statSync(mp4FullFilePath);
          fileByteSize = stats.size;
        } catch (err) {
          //console.log(err)
          fileByteSize = -1;
        }

        if (fileByteSize == -1) {
          console.log(
            `      Error: Failed to obtain byte size for MP4 file: ${someMP4FileName}`
          );
        } else {
          if (fileByteSize == 0) {
            console.log(`      Error: Empty MP4 file: ${someMP4FileName}`);
          } // mp4 file is 0
          else {
            // file is not empty, but let's see if it is corrupted.
            // let's try to get its duration in human readable terms
            let videoLengthInSeconds = 0;
            try {
              videoLengthInSeconds = await getVideoDurationInSeconds(
                mp4FullFilePath
              );
            } catch (error) {
              videoLengthInSeconds = -1;
            }

            if (videoLengthInSeconds == -1) {
              console.log(
                `      Error: Incompletely downloaded MP4 file: ${someMP4FileName}`
              );
            } // corrupt file
            else {
              // this file should be perfect: it exists, it has some size, and we can get a duration on it
              courseTotalMP4FilesConfirmed++;
              courseTotalMP4FileBytes = courseTotalMP4FileBytes + fileByteSize;
              courseTotalMP4DurationInSeconds =
                courseTotalMP4DurationInSeconds + videoLengthInSeconds;
              if (printFileDetails) {
                console.log(
                  `      ${someMP4FileName} is ${getHumanFriendlySize(
                    fileByteSize
                  )} and has duration of: ${getMediaFileDurationHumanFriendly(
                    videoLengthInSeconds
                  )}`
                );
              }
            } // healthy file
          } // mp4 file is not 0
        }
      } // mp4 file does exist
      else {
        console.log(`      Error: Missing MP4 file: ${someMP4FileName}`);
      } // mp4 file does not exist
    } // loop through mp4 file names

    if (mp4FileNames.length > 0) {
      if (mp4FileNames.length !== courseTotalMP4FilesConfirmed) {
        console.log(
          `      Expected ${mp4FileNames.length} MP4 files but only confirmed ${courseTotalMP4FilesConfirmed}`
        );
      } else {
        console.log(
          `\n      Confirmed all ${mp4FileNames.length} MP4 files are accounted for and healthy`
        );
      }
      console.log(
        `      Total Course MP4 files size : ${getHumanFriendlySize(
          courseTotalMP4FileBytes
        )}`
      );
      const humanFriendlyMP4Duration = getMediaFileDurationHumanFriendly(
        courseTotalMP4DurationInSeconds
      );
      console.log(
        `      Total Course MP4 files duration  : ${humanFriendlyMP4Duration}\n`
      );
    }

    //
    // PDF files
    //

    console.log(`\n    has ${pdfFileNames.length} PDF files\n`);

    for (const somPDFFileName of pdfFileNames) {
      const pdfFullFilePath = path.join(
        coursesMainDir,
        course.name,
        'pdfs',
        somPDFFileName
      );
      if (fileExists(pdfFullFilePath)) {
        let fileByteSize = 0;
        try {
          const stats = fs.statSync(pdfFullFilePath);
          fileByteSize = stats.size;
        } catch (err) {
          //console.log(err)
          fileByteSize = -1;
        }

        if (fileByteSize == -1) {
          console.log(
            `      Error: Failed to obtain byte size for PDF file: ${somPDFFileName}`
          );
        } else {
          if (fileByteSize == 0) {
            console.log(`      Error: Empty PDF file: ${somPDFFileName}`);
          } // mp4 file is 0
          else {
            // file is not empty
            courseTotalPDFFilesConfirmed++;
            courseTotalPDFFileBytes = courseTotalPDFFileBytes + fileByteSize;
            if (printFileDetails) {
              console.log(
                `      ${somPDFFileName} is ${getHumanFriendlySize(
                  fileByteSize
                )}`
              );
            }
          } // pdf file is not 0
        }
      } // pdf file does exist
      else {
        console.log(`      Error: Missing MP4 file: ${somPDFFileName}`);
      } // pdf file does not exist
    } // loop through pdf file names

    if (pdfFileNames.length > 0) {
      if (pdfFileNames.length !== courseTotalPDFFilesConfirmed) {
        console.log(
          `      Expected ${pdfFileNames.length} MP4 files but only confirmed ${courseTotalPDFFilesConfirmed}`
        );
      } else {
        console.log(
          `\n      Confirmed all ${pdfFileNames.length} PDF files are accounted for and healthy`
        );
      }
      console.log(
        `      Total Course PDF files size : ${getHumanFriendlySize(
          courseTotalPDFFileBytes
        )}`
      );
    }

    //
    // MP3 files
    //
    console.log(`\n    has ${mp3FileNames.length} MP3 files\n`);

    for (const someMP3FileName of mp3FileNames) {
      const mp3FullFilePath = path.join(
        coursesMainDir,
        course.name,
        'mp3s',
        someMP3FileName
      );
      if (fileExists(mp3FullFilePath)) {
        let fileByteSize = 0;
        try {
          const stats = fs.statSync(mp3FullFilePath);
          fileByteSize = stats.size;
        } catch (err) {
          //console.log(err)
          fileByteSize = -1;
        }

        if (fileByteSize == -1) {
          console.log(
            `      Error: Failed to obtain byte size for MP3 file: ${someMP3FileName}`
          );
        } else {
          if (fileByteSize == 0) {
            console.log(`      Error: Empty MP3 file: ${someMP3FileName}`);
          } // mp3 file is 0
          else {
            // file is not empty, but let's see if it is corrupted.
            // let's try to get its duration
            let durationInMs = 0;
            try {
              const buffer = fs.readFileSync(mp3FullFilePath);
              durationInMs = getMP3Duration(buffer);
            } catch (error) {
              durationInMs = -1;
            }

            if (durationInMs == -1) {
              console.log(
                `      Error: Incompletely downloaded MP3 file: ${someMP3FileName}`
              );
            } // corrupt file
            else {
              const lengthInSeconds = durationInMs / 1000;

              // this file should be perfect: it exists, it has some size, and we can get a duration on it
              courseTotalMP3FilesConfirmed++;
              courseTotalMP3FileBytes = courseTotalMP3FileBytes + fileByteSize;
              courseTotalMP3DurationInSeconds =
                courseTotalMP3DurationInSeconds + lengthInSeconds;
              if (printFileDetails) {
                console.log(
                  `      ${someMP3FileName} is ${getHumanFriendlySize(
                    fileByteSize
                  )} and has duration of: ${getMediaFileDurationHumanFriendly(
                    lengthInSeconds
                  )}`
                );
              }
            } // healthy file
          } // mp4 file is not 0
        }
      } // mp3 file does exist
      else {
        console.log(`      Error: Missing MP3 file: ${someMP3FileName}`);
      } // mp4 file does not exist
    } // loop through mp4 file names

    if (mp3FileNames.length > 0) {
      if (mp3FileNames.length !== courseTotalMP3FilesConfirmed) {
        console.log(
          `      Expected ${mp3FileNames.length} MP3 files but only confirmed ${courseTotalMP3FilesConfirmed}`
        );
      } else {
        console.log(
          `\n      Confirmed all ${mp3FileNames.length} MP3 files are accounted for and healthy`
        );
      }
      console.log(
        `      Total Course MP3 files size : ${getHumanFriendlySize(
          courseTotalMP3FileBytes
        )}`
      );
      const humanFriendlyMP3Duration = getMediaFileDurationHumanFriendly(
        courseTotalMP3DurationInSeconds
      );
      console.log(
        `      Total Course MP3 files duration  : ${humanFriendlyMP3Duration}`
      );
    }

    //
    // update main totals
    //
    totalMP4FileBytes = totalMP4FileBytes + courseTotalMP4FileBytes;
    totalPDFFileBytes = totalPDFFileBytes + courseTotalPDFFileBytes;
    totalMP3FileBytes = totalMP3FileBytes + courseTotalMP3FileBytes;

    totalMP4DurationInSeconds =
      totalMP4DurationInSeconds + courseTotalMP4DurationInSeconds;

    totalMP3DurationInSeconds =
      totalMP3DurationInSeconds + courseTotalMP3DurationInSeconds;

    totalMP4Files = totalMP4Files + courseTotalMP4FilesConfirmed;
    totalMP3Files = totalMP3Files + courseTotalMP3FilesConfirmed;
    totalPDFFiles = totalPDFFiles + courseTotalPDFFilesConfirmed;
  } // loop through course

  console.log(`\n\n`);
  console.log(`      Total MP4 files : ${totalMP4Files}`);
  console.log(`      Total PDF files : ${totalPDFFiles}`);
  console.log(`      Total MP3 files : ${totalMP3Files}`);

  console.log(`\n`);
  console.log(
    `      Total MP4 files size : ${getHumanFriendlySize(totalMP4FileBytes)}`
  );
  console.log(
    `      Total PDF files size : ${getHumanFriendlySize(totalPDFFileBytes)}`
  );
  console.log(
    `      Total MP3 files size : ${getHumanFriendlySize(totalMP3FileBytes)}`
  );

  console.log(`\n`);
  console.log(
    `      Total MP4 files duration : ${getMediaFileDurationHumanFriendly(
      totalMP4DurationInSeconds
    )}`
  );
  console.log(
    `      Total MP3 files duration : ${getMediaFileDurationHumanFriendly(
      totalMP3DurationInSeconds
    )}`
  );
  console.log(`\n\n`);

  const endDateTime = new Date();
  const timeElapsedInMs = endDateTime - startDateTime;
  console.log(
    `Took ${getMediaFileDurationHumanFriendly(
      timeElapsedInMs / 1000
    )} to run this.\n\n`
  );
}

main();
