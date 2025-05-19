#!/bin/bash
git pull
npm install
npm run build
sudo systemctl restart lumiere
