import { useState, useEffect } from 'react';
import { Monitor, Sun, Moon } from '@phosphor-icons/react';
import {
  getThemePreference,
  setThemePreference,
  getHighContrast,
  setHighContrast,
  getThemePalette,
  setThemePalette,
  type ThemePreference,
  type ThemePalette,
} from '../theme';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Monitor }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

const PALETTE_OPTIONS: { value: ThemePalette; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rose', label: 'Rosé' },
{ value: 'rebecca', label: 'Rebecca Purple' },
  { value: 'claude', label: 'Claude' },
];

function LogoJP({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.22 119.76" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M73.11,10.12V129.88l17-17V96a23.81,23.81,0,0,0,23.08-6.16l1.5-1.51h0l1.45-1.44a23.85,23.85,0,0,0,0-33.72ZM101.69,75.4c-4.84,4.84-8.43,2.68-11.58-.25V52.41l9.73,9.72C103.42,65.73,107.42,69.68,101.69,75.4Z" transform="translate(-16.89 -10.12)" />
      <path d="M49.9,27.14V87.6l-9.73-9.73c-3.6-3.59-7.59-7.53-1.85-13.28C41,61.87,43.44,61.3,45.67,62V47.57a4.3,4.3,0,0,0-3.15-4l-.17,0-.51-.08a7.31,7.31,0,0,0-1.76,0,23.75,23.75,0,0,0-13.22,6.7l-2.68,2.68h0l-.3.3a23.83,23.83,0,0,0,0,33.72l43,43V10.12l-17,17v0Z" transform="translate(-16.89 -10.12)" />
    </svg>
  );
}

function LogoHTML5({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>HTML5</title>
      <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z" />
    </svg>
  );
}

function LogoCSS3({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>CSS3</title>
      <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.565-2.438L1.5 0zm17.09 4.413L5.41 4.41l.213 2.622 10.125.002-.255 2.716h-6.64l.24 2.573h6.182l-.366 3.523-2.91.804-2.956-.81-.188-2.11h-2.61l.29 3.855L12 19.288l5.373-1.53L18.59 4.414z" />
    </svg>
  );
}

function LogoJavaScript({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>JavaScript</title>
      <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z" />
    </svg>
  );
}

function LogoTypeScript({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>TypeScript</title>
      <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
    </svg>
  );
}

function LogoReact({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>React</title>
      <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z" />
    </svg>
  );
}

function LogoNodeJS({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Node.js</title>
      <path d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-.315,1.296-.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-.031,0.186-.081 c0.048-.054,0.074-.123,0.067-.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-.584-3.011-1.742c-0.02-.124-.126-.215-.253-.215h-1.137c-.141,0-.254.112-.254.253 c0,1.482.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z" />
    </svg>
  );
}

function LogoPostgreSQL({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>PostgreSQL</title>
      <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698z" />
    </svg>
  );
}

function LogoGraphQL({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>GraphQL</title>
      <path d="M12.002 0a2.138 2.138 0 1 0 0 4.277 2.138 2.138 0 1 0 0-4.277zm8.54 4.931a2.138 2.138 0 1 0 0 4.277 2.138 2.138 0 1 0 0-4.277zm0 9.862a2.138 2.138 0 1 0 0 4.277 2.138 2.138 0 1 0 0-4.277zm-8.54 4.931a2.138 2.138 0 1 0 0 4.276 2.138 2.138 0 1 0 0-4.276zm-8.542-4.93a2.138 2.138 0 1 0 0 4.276 2.138 2.138 0 1 0 0-4.277zm0-9.863a2.138 2.138 0 1 0 0 4.277 2.138 2.138 0 1 0 0-4.277zm8.542-3.378L2.953 6.777v10.448l9.049 5.224 9.047-5.224V6.777zm0 1.601 7.66 13.27H4.34zm-1.387.371L3.97 15.037V7.363zm2.774 0 6.646 3.838v7.674zM5.355 17.44h13.293l-6.646 3.836z" />
    </svg>
  );
}

function LogoTailwind({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Tailwind CSS</title>
      <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z" />
    </svg>
  );
}

function LogoVite({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Vite</title>
      <path d="m8.286 10.578.512-8.657a.306.306 0 0 1 .247-.282L17.377.006a.306.306 0 0 1 .353.385l-1.558 5.403a.306.306 0 0 0 .352.385l2.388-.46a.306.306 0 0 1 .332.438l-6.79 13.55-.123.19a.294.294 0 0 1-.252.14c-.177 0-.35-.152-.305-.369l1.095-5.301a.306.306 0 0 0-.388-.355l-1.433.435a.306.306 0 0 1-.389-.354l.69-3.375a.306.306 0 0 0-.37-.36l-1.593.397a.306.306 0 0 1-.381-.319z" />
    </svg>
  );
}

function LogoPWA({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1952 734.93" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>PWA</title>
      <path d="M1436.62,603.304L1493.01,460.705L1655.83,460.705L1578.56,244.39L1675.2,0.000528336L1952,734.933L1747.87,734.933L1700.57,603.304L1436.62,603.304Z" />
      <path d="M1262.47,734.935L1558.79,0.00156593L1362.34,0.0025425L1159.64,474.933L1015.5,0.00351906L864.499,0.00351906L709.731,474.933L600.585,258.517L501.812,562.819L602.096,734.935L795.427,734.935L935.284,309.025L1068.63,734.935L1262.47,734.935Z" />
      <path d="M186.476,482.643L307.479,482.643C344.133,482.643 376.772,478.552 405.396,470.37L436.689,373.962L524.148,104.516C517.484,93.9535 509.876,83.9667 501.324,74.5569C456.419,24.852 390.719,0.000406265 304.222,0.000406265L-3.8147e-006,0.000406265L-3.8147e-006,734.933L186.476,734.933L186.476,482.643ZM346.642,169.079C364.182,186.732 372.951,210.355 372.951,239.95C372.951,269.772 365.238,293.424 349.813,310.906C332.903,330.331 301.766,340.043 256.404,340.043L186.476,340.043L186.476,142.598L256.918,142.598C299.195,142.598 329.103,151.425 346.642,169.079Z" />
    </svg>
  );
}

function LogoCloudflare({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Cloudflare</title>
      <path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727" />
    </svg>
  );
}

function LogoAnthropic({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Anthropic</title>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Z" />
      <path d="M10.5363 3.5409L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

const CREDITS: { name: string; href: string; Logo: React.FC<{ size?: number }> }[] = [
  { name: 'JP DeVries', href: 'https://devries.jp', Logo: LogoJP },
  { name: 'HTML5', href: 'https://html.spec.whatwg.org/', Logo: LogoHTML5 },
  { name: 'CSS3', href: 'https://www.w3.org/Style/CSS/', Logo: LogoCSS3 },
  { name: 'JavaScript', href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', Logo: LogoJavaScript },
  { name: 'TypeScript', href: 'https://www.typescriptlang.org/', Logo: LogoTypeScript },
  { name: 'React', href: 'https://react.dev/', Logo: LogoReact },
  { name: 'Node.js', href: 'https://nodejs.org/', Logo: LogoNodeJS },
  { name: 'PostgreSQL', href: 'https://www.postgresql.org/', Logo: LogoPostgreSQL },
  { name: 'GraphQL', href: 'https://graphql.org/', Logo: LogoGraphQL },
  { name: 'Tailwind CSS', href: 'https://tailwindcss.com/', Logo: LogoTailwind },
  { name: 'Vite', href: 'https://vite.dev/', Logo: LogoVite },
  { name: 'PWA', href: 'https://web.dev/progressive-web-apps/', Logo: LogoPWA },
  { name: 'Cloudflare', href: 'https://www.cloudflare.com/', Logo: LogoCloudflare },
  { name: 'Anthropic', href: 'https://www.anthropic.com/', Logo: LogoAnthropic },
];

export default function Footer() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [hc, setHC] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('default');

  useEffect(() => {
    setTheme(getThemePreference());
    setHC(getHighContrast());
    setPalette(getThemePalette());
  }, []);

  function handleTheme(pref: ThemePreference) {
    setTheme(pref);
    setThemePreference(pref);
  }

  function handleHC(enabled: boolean) {
    setHC(enabled);
    setHighContrast(enabled);
  }

  function handlePalette(p: ThemePalette) {
    setPalette(p);
    setThemePalette(p);
  }

  return (
    <footer className="no-print border-t border-zinc-200 dark:border-zinc-800 mt-16 pt-10 pb-8 px-4 sm:px-6 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Volume</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 cup</dt> <dd className="inline">= 16 <abbr title="tablespoons">tbsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="tablespoon">tbsp</abbr></dt> <dd className="inline">= 3 <abbr title="teaspoons">tsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 cup</dt> <dd className="inline">= 237 <abbr title="millilitres">ml</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="fluid ounce">fl oz</abbr></dt> <dd className="inline">= 30 <abbr title="millilitres">ml</abbr></dd></div>
              <div><dt className="inline font-medium">1 quart</dt> <dd className="inline">= 4 cups</dd></div>
              <div><dt className="inline font-medium">1 gallon</dt> <dd className="inline">= 4 quarts</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Weight</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 <abbr title="ounce">oz</abbr></dt> <dd className="inline">= 28.35 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="pound">lb</abbr></dt> <dd className="inline">= 16 <abbr title="ounces">oz</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="pound">lb</abbr></dt> <dd className="inline">= 454 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="kilogram">kg</abbr></dt> <dd className="inline">= 2.2 <abbr title="pounds">lb</abbr></dd></div>
              <div><dt className="inline font-medium">1 stick butter</dt> <dd className="inline">= 113 <abbr title="grams">g</abbr></dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Temperature</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">250 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 121 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">350 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 177 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">400 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 204 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">450 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 232 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">750 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 399 <abbr title="Celsius">°C</abbr></dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Handy</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 clove garlic</dt> <dd className="inline">≈ 1 <abbr title="teaspoon">tsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 lemon</dt> <dd className="inline">≈ 3 <abbr title="tablespoons">tbsp</abbr> juice</dd></div>
              <div><dt className="inline font-medium">1 lime</dt> <dd className="inline">≈ 2 <abbr title="tablespoons">tbsp</abbr> juice</dd></div>
              <div><dt className="inline font-medium">1 egg</dt> <dd className="inline">≈ 50 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">Pinch</dt> <dd className="inline">≈ ⅛ <abbr title="teaspoon">tsp</abbr></dd></div>
            </dl>
          </div>
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-2">
          <p className="font-serif font-bold text-sm text-zinc-700 dark:text-zinc-300" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>Pantry Host</p>
          <p className="mt-2 legible text-zinc-500 dark:text-zinc-400 pretty">
            An open source, self-hosted kitchen companion that runs entirely on your home network or mobile&nbsp;device.<br/>Your recipes, your data, your&nbsp;machine.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Accessibility:</span> We strive to meet Level AA of the latest WCAG accessibility guidelines so that Pantry Host is as accessible to everyone as&nbsp;possible.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Privacy:</span> Pantry Host stores all data locally on your machine&nbsp;&mdash; nothing is sent to external servers. No accounts, no tracking, no analytics. If you choose to enable AI features, requests are sent directly to the Anthropic API using your own key and are not stored or used for&nbsp;training.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            Optionally enhanced by <a href="https://claude.ai/download" className="hover:underline text-zinc-600 dark:text-zinc-300">Claude&nbsp;Code</a>&nbsp;&mdash; import recipes from any URL, generate new ones from what you have on hand, and manage your pantry conversationally. AI features require an API key and are entirely&nbsp;opt&#8209;in.
          </p>

          {/* Theme toggle + GitHub */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-y-3">
            <div className="flex flex-wrap items-center gap-4 gap-y-3">
              {/* Theme preference */}
              <div role="radiogroup" aria-label="Theme" className="flex items-center gap-1">
                {THEME_OPTIONS.map(({ value, label, Icon }) => {
                  const active = theme === value;
                  return (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={active}
                      aria-label={`${label} theme`}
                      onClick={() => handleTheme(value)}
                      className={`p-1.5 rounded transition-colors ${
                        active
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                    </button>
                  );
                })}
              </div>

              {/* Palette selector */}
              <label className="flex items-center gap-1.5 select-none">
                <span className="text-xs">Palette</span>
                <select
                  value={palette}
                  onChange={(e) => handlePalette(e.target.value as ThemePalette)}
                  className="text-xs bg-transparent border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5"
                  aria-label="Color palette"
                >
                  {PALETTE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {/* High contrast toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hc}
                  onChange={(e) => handleHC(e.target.checked)}
                  className="w-3.5 h-3.5 accent-accent"
                />
                <span className="text-xs">High contrast</span>
              </label>
            </div>

          </div>

          {/* Credits + GitHub */}
          <div className="mt-6 flex items-start justify-between">
          <details className="credits-details">
            <summary className="inline-flex items-center gap-1.5 text-xs bg-transparent rounded px-1.5 py-0.5 cursor-pointer select-none hover:underline list-none [&::-webkit-details-marker]:hidden text-zinc-500 dark:text-zinc-400 outline-none">
              Credits
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width={8} height={8} fill="currentColor" aria-hidden="true" className="credits-chevron">
                <path d="M443.5 162.6l-7.1-7.1c-4.7-4.7-12.3-4.7-17 0L224 351 28.5 155.5c-4.7-4.7-12.3-4.7-17 0l-7.1 7.1c-4.7 4.7-4.7 12.3 0 17l211 211.1c4.7 4.7 12.3 4.7 17 0l211-211.1c4.8-4.7 4.8-12.3.1-17z" />
              </svg>
            </summary>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-4 items-center" style={{ paddingTop: '0.25rem' }}>
              {CREDITS.map(({ name, href, Logo }) => (
                <a key={name} href={href} rel="noopener" className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors" aria-label={name} title={name}>
                  <Logo size={28} />
                </a>
              ))}
            </div>
          </details>
            <a href="https://github.com/jpdevries/pantry-host" className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors" aria-label="Pantry Host on GitHub">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
