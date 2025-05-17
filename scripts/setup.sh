#!/bin/bash
if [ "$(whoami)" != "root" ]; then
	echo "Sorry, you are not root. Re-run this script using sudo"
	exit 1
fi

# install dependencies
apt-get install openssl libavahi-compat-libdnssd-dev curl unzip

# install fnm
curl -fsSL https://fnm.vercel.app/install | bash
FNM_PATH="/home/pi/.local/share/fnm"
if [ -d "$FNM_PATH" ]; then
  export PATH="$FNM_PATH:$PATH"
  eval "`fnm env`"
fi

fnm i v24.0.2

# build the app & web client
npm install
npm run build

# generate self signed ssl certs
ip address show | grep -Po '(?<=inet )\d*.\d*.\d*.\d*.(?=/)' | while read -r line
do
    if [[ $line != '127.0.0.1' ]]; then
        echo $line
        mkdir ssl
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -subj "/C=US/CN=$line" -keyout ssl/server.key -out ssl/server.crt
        break
    fi
done
chmod +r ssl/server.key

# set the app-server to auto start on boot
cp scripts/systemd.conf /etc/systemd/system/lumiere.service
cwd=$(pwd)
sed -i.bak 's|CWD|'"$cwd"'|g' /etc/systemd/system/lumiere.service
rm /etc/systemd/system/lumiere.service.bak
systemctl enable lumiere
