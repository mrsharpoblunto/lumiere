# Given a filename, a regex pattern to match and a replacement string,
# perform replacement if found, else append replacement to end of file.
# (# $1 = filename, $2 = pattern to match, $3 = replacement)
reconfig() {
	grep $2 $1 >/dev/null
	if [ $? -eq 0 ]; then
		# Pattern found; replace in file
		sed -i "s/$2/$3/g" $1 >/dev/null
	else
		# Not found; append (silently)
		echo $3 | sudo tee -a $1 >/dev/null
	fi
}

reconfig /boot/config.txt "^.*dtparam=audio.*$" "dtparam=audio=off"
# reconfig /boot/config.txt "^.*dtparam=audio.*$" "dtparam=audio=on"
