#!/bin/bash

clear
COURSE_FOLDER_NAME=$1
echo 
echo
echo 'Video files taking up this much space:'
echo '--------------------------------------'
du -h ${COURSE_FOLDER_NAME}/videos

echo
echo 'MP3 files taking up this much space:'
echo '------------------------------------'
du -h ${COURSE_FOLDER_NAME}/mp3s

echo
echo 'PDF files taking up this much space:'
echo '------------------------------------'
du -h ${COURSE_FOLDER_NAME}/pdfs

echo 
echo 'How much disk space does my computer have?:'
echo '-------------------------------------------'
df -h
echo
echo

