# Contributing

1. Clone this project, and clone `selective-edit` and link them together.

```
git clone git@github.com:blinkk/editor.dev-ui.git
git clone git@github.com:blinkk/selective-edit.git
cd selective-edit
yarn install
yarn link
cd ../editor.dev-ui
yarn install
yarn link @blinkk/selective-edit
make watch
```

2. Run the development server and iterate.

```
yarn run serve
# http://localhost:8888/
```
