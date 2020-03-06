develop:
	cd editor \
	  && yarn install
	grow install -f example

watch:
	cd editor \
	  && yarn run watch

run:
	grow run example
