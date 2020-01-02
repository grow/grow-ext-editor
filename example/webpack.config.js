const path = require('path');
const readdirRecursive = require('fs-readdir-recursive');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const config = {
  JS_SOURCE_DIR: './source/js/composite/',
  JS_SOURCES: [
    './partials/**/*.js',
    './source/js/**/*.js',
  ],
  JS_OUT_DIR: './dist/js/composite/',
  SASS_SOURCE_DIR: './source/sass/composite/',
  SASS_SOURCES: [
    './partials/**/*.{sass,scss}',
    './source/sass/**/*.{sass,scss}',
  ],
  SASS_OUT_DIR: './dist/css/composite/'
};

const jsFiles = readdirRecursive(config.JS_SOURCE_DIR);
const entry = {};
jsFiles.forEach(function(value) {
  if (value.endsWith('.js')) {
    const key = value.substring(0, value.length - 3);
    entry[key] = config.JS_SOURCE_DIR + value;
  }
});

const sassFiles = readdirRecursive(config.SASS_SOURCE_DIR);
sassFiles.forEach(function(value) {
  if (value.endsWith('.sass')) {
    const key = value.substring(0, value.length - 5);
    entry[key] = config.SASS_SOURCE_DIR + value;
  }
});

module.exports = {
  mode: 'development',
  entry: entry,
  output: {
    filename: 'js/[name].min.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].min.css',
      path: path.resolve(__dirname, 'dist'),
    })
  ],
  module: {
    rules: [{
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader',
      },
      {
        test: /\.(sa|sc|c)ss$/,

        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              hmr: process.env.NODE_ENV === 'development',
            },
          },
          'css-loader',
          'postcss-loader',
          'sass-loader',
        ]
      }
    ]
  }
};
