#!/bin/bash

# Create directory if it doesn't exist
mkdir -p /Users/dev/repos/knowledge-base/.obsidian/plugins/4th-brain

yarn build

cp ./*.js /Users/dev/repos/knowledge-base/.obsidian/plugins/4th-brain/
cp ./*.css /Users/dev/repos/knowledge-base/.obsidian/plugins/4th-brain/
cp ./manifest.json /Users/dev/repos/knowledge-base/.obsidian/plugins/4th-brain/
cp ./.hotreload /Users/dev/repos/knowledge-base/.obsidian/plugins/4th-brain/