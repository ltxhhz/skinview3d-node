#!/bin/bash

Xvfb :99 &
export DISPLAY=:99

npm run start
