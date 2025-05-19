#!/bin/bash
git pull
npm install
npm run build:client
sudo systemctl restart lumiere
