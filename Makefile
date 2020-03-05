develop:
	cd editor \
	  && yarn install

watch:
	cd editor \
	  && yarn run watch

run:
	grow install -f example
	grow run example
