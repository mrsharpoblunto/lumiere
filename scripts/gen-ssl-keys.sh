#!/bin/bash
# generate a self signed ssl cert
ip address show | grep -Po '(?<=inet )\d*.\d*.\d*.\d*.(?=/)' | while read -r line
do
    if [[ $line != '127.0.0.1' ]]; then
        mkdir ssl
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -subj "/C=US/CN=$line" -keyout ssl/server.key -out ssl/server.crt
        break
    fi
done
