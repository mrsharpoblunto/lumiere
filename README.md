# Lumiere

Control an LED matrix for an animated display on a Raspberry Pi.

![Fireplace installation](/fireplace.gif)

## Hardware

- Adafruit LED matrix screen like [this](https://www.adafruit.com/product/420)
- Adafruit Raspberry PI Hat [Amazon](https://www.amazon.com/gp/product/B00SK69C6E/ref=ppx_yo_dt_b_asin_title_o00_s01?ie=UTF8&psc=1)
- DC adapter [Amazon](https://www.amazon.com/gp/product/B07CMM2BBR/ref=ppx_od_dt_b_asin_title_s00?ie=UTF8&psc=1)

## Software

- To install, run `./scripts/setup.sh`
- Turn off onboard sound by setting `dtparam=audio=off` in `/boot/firmware/config.txt`
    - NOTE: you may also need to add `blacklist snd_bcm2835` to `/etc/modprobe.d/raspi-blacklist.conf`
- Add to HomeKit by entering the pin `HOMEKIT_PINCODE` located in `src/server/config.ts`
- Navigate to the webUI on https://<address_of_pi/

![Web UI](/screenshot.png)

## Using LetsEncrypt

To use a real SSL certificate requires a few config changes and some additional configuration (assuming you're using cloudflare).

- `sudo apt install certbot`
- `sudo apt install python3-certbot-dns-cloudflare`
- Create a file in `/etc/letsencrypt/cloudflare.ini`

```
# Cloudflare example
dns_cloudflare_email = your-email@example.com
dns_cloudflare_api_key = your-api-key
```

- Secure the credentials file `sudo chmod 600 /etc/letsencrypt/cloudflare.ini`
- Request your certificate

```
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d yourdomain.com
```

- Check that automatic renewal works `sudo certbot renew --dry-run`
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

- Add an update renewal hook at `/etc/letsencrypt/renewal-hooks/post/restart-lumiere.sh`

```
#!/bin/bash
systemctl restart lumiere
```

- Make it executable `sudo chmod +x /etc/letsencrypt/renewal-hooks/post/restart-nodejs.sh`
- Test that cert renewal works `sudo certbot renew --dry-run`
