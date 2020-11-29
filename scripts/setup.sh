#!/bin/bash
if [ "$(whoami)" != "root" ]; then
	echo "Sorry, you are not root. Re-run this script using sudo"
	exit 1
fi

# install dependencies
apt-get install openssl libavahi-compat-libdnssd-dev nodejs npm

# build the app & web client
npm install --production
npm run build

# generate self signed ssl certs
./gen-ssl-certs.sh

# set the app-server to auto start on boot
cp scripts/systemd.conf /etc/systemd/system/fyreplace.service
cwd=$(pwd)
sed -i.bak 's|CWD|'"$cwd"'|g' /etc/systemd/system/fyreplace.service
rm /etc/systemd/system/fyreplace.service.bak
systemctl enable fyreplace
