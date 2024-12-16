# Lumiere
Control an LED matrix for an animated display on a Raspberry Pi. Also optionally provides accompanying audio & control over Philips Hue lights

![Freplace installation](/fireplace.gif)

## Installing

Run ```./scripts/setup.sh```

## Usage

- Add to HomeKit by entering the pin in `HOMEKIT_PINCODE` in `src/server/config.mjs`
- Also control a Philips hue light group by updating `HUE_BRIDGE_IP`, `HUE_USER`, and `HUE_LIGHT_GROUP` in `src/server/config.mjs`
- Navigate to the webUI on https://<address_of_pi/

![Web UI](/screenshot.png)

## Using LetsEncrypt
To use a real SSL certificate requires a few config changes and some additional configuration (assuming you're using cloudflare).

- ```sudo apt install certbot```
- ```sudo apt install python3-certbot-dns-cloudflare```
- Create a file in ```/etc/letsencrypt/cloudflare.ini```
```
# Cloudflare example
dns_cloudflare_email = your-email@example.com
dns_cloudflare_api_key = your-api-key
```
- Secure the credentials file ```sudo chmod 600 /etc/letsencrypt/dns-credentials.ini```
- Request your certificate
```
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d yourdomain.com
```
- Check that automatic renewal works ```sudo certbot renew --dry-run```
- Ensure lumiere has access to the certs
```
# Create a new group
sudo groupadd sslcerts

# Add your user to the group
sudo usermod -a -G sslcerts $USER

# Change group ownership of the certificates directory
sudo chgrp -R sslcerts /etc/letsencrypt/live
sudo chgrp -R sslcerts /etc/letsencrypt/archive

# Set permissions to allow group read
sudo chmod -R g+rX /etc/letsencrypt/live
sudo chmod -R g+rX /etc/letsencrypt/archive
```
- Update src/server/config.mjs SSL_KEY and SSL_CERT paths
```
export const SSL_KEY =
  '/etc/letsencrypt/live/yourdomain.com/privkey.pem';
export const SSL_CERT =
  '/etc/letsencrypt/live/yourdomain.com/fullchain.pem';
```
- Add an update renewal hook at ```/etc/letsencrypt/renewal-hooks/post/restart-lumiere.sh```
```
#!/bin/bash
systemctl restart lumiere
```
- Make it executable ```sudo chmod +x /etc/letsencrypt/renewal-hooks/post/restart-nodejs.sh```
- Test that cert renewal works ```sudo certbot renew --dry-run```
