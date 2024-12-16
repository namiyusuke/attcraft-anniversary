module.exports = {
  extends: ["stylelint-config-html", "stylelint-config-recess-order"],
  ignoreFiles: ["**/node_modules/**"],
  rules: {
    "selector-id-pattern": null,
    "selector-class-pattern": null,
    "keyframes-name-pattern": null,
  },
};
