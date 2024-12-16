/** @type {import('tailwindcss').Config} */

const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const plugin = require("tailwindcss/plugin");

// CSSファイルの読み込み
const cssFiles = plugin(({ addBase, addComponents, addUtilities }) => {
  const dirname = "src/assets/css";
  const files = fs.readdirSync(dirname);

  for (const file of files) {
    const matched = /^(base|components|utilities)\..+\.css$/.exec(file);

    if (matched) {
      const layer = matched[1];
      const addStyles = {
        base: addBase,
        components: addComponents,
        utilities: addUtilities,
      }[layer];
      const content = fs.readFileSync(path.join(dirname, file), "utf8");
      const styles = postcss.parse(content);

      addStyles(styles.nodes);
    }
  }
});

const defaultViewPort = {
  min: 375,
  max: 1440,
};

// px を rem に変換
const rem = (px) => `${px / 16}rem`;

// clamp関数
const getClamp = (minSize, maxSize, minViewPort, maxViewPort) => {
  const valiablePart = (maxSize - minSize) / (maxViewPort - minViewPort);

  const constant = -minViewPort * valiablePart + minSize;
  return `clamp(${rem(minSize)},  ${rem(constant)} + ${100 * valiablePart}vw, ${rem(maxSize)})`;
};

// clamp関数
const getFluid = (value) => {
  const [minSize, maxSize, minViewPort, maxViewPort] = value.split(",");
  return getClamp(Number(minSize), Number(maxSize), Number(minViewPort) | defaultViewPort.min, Number(maxViewPort) | defaultViewPort.max);
};

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  corePlugins: {
    // preflight: false,
  },
  theme: {
    fontFamily: {
      sans: ["Roboto", "Noto Sans JP", "sans-serif"],
    },
    extend: {
      colors: {
        dark: "#151313",
        navy: "#15143F",
        "light-gray": "#E6E6E6",
        line: "#B6C1D3",
      },
    },
  },
  plugins: [
    cssFiles,
    plugin(function ({ matchUtilities, addVariant }) {
      addVariant("hocus", ["&:hover", "&:focus-visible"]),
        addVariant("beforeAfter", ["&:before", "&:after"]),
        matchUtilities(
          {
            "text-fluid": (value) => ({
              fontSize: getFluid(value),
            }),
            "p-fluid": (value) => ({
              padding: getFluid(value),
            }),
            "py-fluid": (value) => ({
              paddingTop: getFluid(value),
              paddingBottom: getFluid(value),
            }),
            "px-fluid": (value) => ({
              paddingLeft: getFluid(value),
              paddingRight: getFluid(value),
            }),
            "pt-fluid": (value) => ({
              paddingTop: getFluid(value),
            }),
            "pr-fluid": (value) => ({
              paddingRight: getFluid(value),
            }),
            "pb-fluid": (value) => ({
              paddingBottom: getFluid(value),
            }),
            "pl-fluid": (value) => ({
              paddingLeft: getFluid(value),
            }),
            "m-fluid": (value) => ({
              margin: getFluid(value),
            }),
            "my-fluid": (value) => ({
              marginTop: getFluid(value),
              marginBottom: getFluid(value),
            }),
            "mx-fluid": (value) => ({
              marginLeft: getFluid(value),
              marginRight: getFluid(value),
            }),
            "mt-fluid": (value) => ({
              marginTop: getFluid(value),
            }),
            "mr-fluid": (value) => ({
              marginRight: getFluid(value),
            }),
            "mb-fluid": (value) => ({
              marginBottom: getFluid(value),
            }),
            "ml-fluid": (value) => ({
              marginLeft: getFluid(value),
            }),
            "w-fluid": (value) => ({
              width: getFluid(value),
            }),
            "gap-fluid": (value) => ({
              gap: getFluid(value),
            }),
            "gap-x-fluid": (value) => ({
              columnGap: getFluid(value),
            }),
            "gap-y-fluid": (value) => ({
              rowGap: getFluid(value),
            }),
            "inset-fluid": (value) => ({
              inset: getFluid(value),
            }),
            "inset-y-fluid": (value) => ({
              top: getFluid(value),
              bottom: getFluid(value),
            }),
            "inset-x-fluid": (value) => ({
              left: getFluid(value),
              right: getFluid(value),
            }),
            "top-fluid": (value) => ({
              top: getFluid(value),
            }),
            "right-fluid": (value) => ({
              right: getFluid(value),
            }),
            "bottom-fluid": (value) => ({
              bottom: getFluid(value),
            }),
            "left-fluid": (value) => ({
              left: getFluid(value),
            }),
          },
          {
            values: {
              xs: "4,8",
              sm: "8,16",
              md: "16,24",
              lg: "24,32",
              xl: "32,40",
            },
          }
        );
    }),
  ],
};
