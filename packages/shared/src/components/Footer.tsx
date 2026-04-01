import { useState, useEffect } from 'react';
import { Monitor, Sun, Moon, Code } from '@phosphor-icons/react';
import {
  getThemePreference,
  setThemePreference,
  getHighContrast,
  setHighContrast,
  getExplicitPalette,
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
      <path d="M17.128 0a10.134 10.134 0 0 0-2.755.403l-.063.02A10.922 10.922 0 0 0 12.6.258C11.422.238 10.41.524 9.594 1 8.79.721 7.122.24 5.364.336 4.14.403 2.804.775 1.814 1.82.827 2.865.305 4.482.415 6.682c.03.607.203 1.597.49 2.879s.69 2.783 1.193 4.152c.503 1.37 1.054 2.6 1.915 3.436.43.419 1.022.771 1.72.742.49-.02.933-.235 1.315-.552.186.245.385.352.566.451.228.125.45.21.68.266.413.103 1.12.241 1.948.1.282-.047.579-.139.875-.27.011.33.024.653.037.98.041 1.036.067 1.993.378 2.832.05.137.187.843.727 1.466.54.624 1.598 1.013 2.803.755.85-.182 1.931-.51 2.649-1.532.71-1.01 1.03-2.459 1.093-4.809.016-.127.035-.235.055-.336l.169.015h.02c.907.041 1.891-.088 2.713-.47.728-.337 1.279-.678 1.68-1.283.1-.15.21-.331.24-.643s-.149-.8-.446-1.025c-.595-.452-.969-.28-1.37-.197a6.27 6.27 0 0 1-1.202.146c1.156-1.947 1.985-4.015 2.458-5.845.28-1.08.437-2.076.45-2.947.013-.871-.058-1.642-.58-2.309C21.36.6 19.067.024 17.293.004c-.055-.001-.11-.002-.165-.001zm-.047.64c1.678-.016 3.822.455 5.361 2.422.346.442.449 1.088.437 1.884-.013.795-.16 1.747-.429 2.79-.522 2.02-1.508 4.375-2.897 6.488a.756.756 0 0 0 .158.086c.29.12.951.223 2.27-.048.332-.07.575-.117.827.075a.52.52 0 0 1 .183.425.704.704 0 0 1-.13.336c-.255.383-.758.746-1.403 1.045-.571.266-1.39.405-2.116.413-.364.004-.7-.024-.985-.113l-.018-.007c-.11 1.06-.363 3.153-.528 4.108-.132.77-.363 1.382-.804 1.84-.44.458-1.063.734-1.901.914-1.038.223-1.795-.017-2.283-.428-.487-.41-.71-.954-.844-1.287-.092-.23-.14-.528-.186-.926-.046-.398-.08-.885-.103-1.434a51.426 51.426 0 0 1-.03-2.523 3.061 3.061 0 0 1-1.552.76c-.689.117-1.304.002-1.671-.09a2.276 2.276 0 0 1-.52-.201c-.17-.091-.332-.194-.44-.397a.56.56 0 0 1-.057-.381.61.61 0 0 1 .218-.331c.198-.161.46-.251.855-.333.719-.148.97-.249 1.123-.37.13-.104.277-.314.537-.622a1.16 1.16 0 0 1-.003-.041 2.96 2.96 0 0 1-1.33-.358c-.15.158-.916.968-1.85 2.092-.393.47-.827.74-1.285.759-.458.02-.872-.211-1.224-.552-.703-.683-1.264-1.858-1.753-3.186-.488-1.328-.885-2.807-1.167-4.067-.283-1.26-.45-2.276-.474-2.766-.105-2.082.382-3.485 1.217-4.37.836-.885 1.982-1.22 3.099-1.284 2.005-.115 3.909.584 4.294.734.742-.504 1.698-.818 2.892-.798a7.39 7.39 0 0 1 1.681.218l.02-.009a6.854 6.854 0 0 1 .739-.214A9.626 9.626 0 0 1 17.08.642zm.152.67h-.146a8.74 8.74 0 0 0-1.704.192c1.246.552 2.187 1.402 2.85 2.25a8.44 8.44 0 0 1 1.132 1.92c.11.264.184.487.226.66.021.087.035.16.04.236.002.038.004.077-.012.144 0 .003-.005.01-.006.013.03.876-.187 1.47-.213 2.306-.02.606.135 1.318.173 2.095.036.73-.052 1.532-.526 2.319.04.048.076.096.114.144 1.254-1.975 2.158-4.16 2.64-6.023.258-1.003.395-1.912.407-2.632.01-.72-.124-1.242-.295-1.46-1.342-1.716-3.158-2.153-4.68-2.165zm-4.79.256c-1.182.003-2.03.36-2.673.895-.663.553-1.108 1.31-1.4 2.085-.347.92-.466 1.81-.513 2.414l.013-.008c.357-.2.826-.4 1.328-.516.502-.115 1.043-.151 1.533.039s.895.637 1.042 1.315c.704 3.257-.219 4.468-.559 5.382a9.61 9.61 0 0 0-.331 1.013c.043-.01.086-.022.129-.026.24-.02.428.06.54.108.342.142.577.44.704.78.033.089.057.185.071.284a.336.336 0 0 1 .02.127 55.14 55.14 0 0 0 .013 3.738c.023.538.057 1.012.1 1.386.043.373.104.657.143.753.128.32.315.739.653 1.024.338.284.823.474 1.709.284.768-.165 1.242-.394 1.559-.723.316-.329.505-.787.626-1.488.181-1.05.545-4.095.589-4.668-.02-.432.044-.764.182-1.017.142-.26.362-.419.552-.505.095-.043.184-.072.257-.093a5.956 5.956 0 0 0-.243-.325 4.456 4.456 0 0 1-.666-1.099 8.296 8.296 0 0 0-.257-.483c-.133-.24-.301-.54-.477-.877-.352-.675-.735-1.493-.934-2.29-.198-.796-.227-1.62.281-2.201.45-.516 1.24-.73 2.426-.61-.035-.105-.056-.192-.115-.332a7.817 7.817 0 0 0-1.041-1.764c-1.005-1.285-2.632-2.559-5.146-2.6h-.115zm-6.642.052c-.127 0-.254.004-.38.011-1.01.058-1.965.351-2.648 1.075-.684.724-1.134 1.911-1.036 3.876.019.372.181 1.414.459 2.652.277 1.238.67 2.695 1.142 3.982.473 1.287 1.046 2.407 1.59 2.937.274.265.512.372.728.363.217-.01.478-.135.797-.518a43.244 43.244 0 0 1 1.81-2.048 3.497 3.497 0 0 1-1.167-3.15c.103-.739.117-1.43.105-1.976-.012-.532-.05-.886-.05-1.107a.336.336 0 0 1 0-.019v-.005l-.001-.006v-.001a9.893 9.893 0 0 1 .592-3.376c.28-.744.697-1.5 1.322-2.112-.614-.202-1.704-.51-2.884-.568a7.603 7.603 0 0 0-.38-.01zM18.199 6.9c-.679.009-1.06.184-1.26.413-.283.325-.31.895-.134 1.597.175.703.537 1.489.877 2.142.17.327.335.621.468.86.134.24.232.41.292.555.055.134.116.252.178.362.263-.555.31-1.1.283-1.668-.035-.703-.198-1.422-.174-2.15.027-.851.195-1.405.21-2.063a5.793 5.793 0 0 0-.74-.048zm-8.234.115a2.82 2.82 0 0 0-.616.074 4.665 4.665 0 0 0-1.153.449 2.417 2.417 0 0 0-.349.228l-.022.02c.006.146.035.5.047 1.021.012.57-.002 1.297-.112 2.084-.239 1.71 1.002 3.126 2.46 3.128.085-.351.225-.707.365-1.082.406-1.094 1.205-1.892.532-5.006-.11-.51-.328-.716-.628-.832a1.474 1.474 0 0 0-.524-.084zm7.917.204h.05c.066.002.127.009.18.022.054.012.1.03.138.055a.164.164 0 0 1 .075.11l-.001.008h.001-.001a.24.24 0 0 1-.035.135.668.668 0 0 1-.11.15.677.677 0 0 1-.386.212.59.59 0 0 1-.41-.103.608.608 0 0 1-.13-.118.26.26 0 0 1-.063-.127.17.17 0 0 1 .042-.128.384.384 0 0 1 .117-.09c.096-.054.226-.094.373-.116.055-.008.109-.012.16-.013zm-7.82.168c.053 0 .109.005.166.013.153.021.289.062.393.122a.446.446 0 0 1 .133.106.223.223 0 0 1 .054.17.302.302 0 0 1-.075.154.649.649 0 0 1-.143.13.64.64 0 0 1-.448.113.728.728 0 0 1-.42-.228.71.71 0 0 1-.118-.164.28.28 0 0 1-.041-.177c.015-.108.104-.164.191-.195a.866.866 0 0 1 .307-.04zm9.06 7.343l-.003.001c-.147.053-.268.075-.37.12a.452.452 0 0 0-.239.214c-.063.115-.117.319-.101.666a.51.51 0 0 0 .148.07c.171.052.458.086.778.081.638-.007 1.423-.156 1.84-.35a3.95 3.95 0 0 0 .943-.615h-.001c-1.393.288-2.18.211-2.663.012a1.315 1.315 0 0 1-.332-.2zm-8.031.094h-.021c-.053.005-.13.023-.279.188-.348.39-.47.635-.757.864-.287.228-.66.35-1.405.503-.236.048-.371.101-.461.144.029.024.026.03.07.053.109.06.249.113.362.142.32.08.846.173 1.395.08.549-.094 1.12-.357 1.607-1.04.084-.118.093-.292.024-.479-.07-.187-.223-.348-.331-.393a.653.653 0 0 0-.204-.06z" />
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

function LogoDocker({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Docker</title>
      <path d="M349.9 236.3h-66.1v-59.4h66.1v59.4zm0-204.3h-66.1v60.7h66.1V32zm78.2 144.8H362v59.4h66.1v-59.4zm-156.3-72.1h-66.1v60.1h66.1v-60.1zm78.1 0h-66.1v60.1h66.1v-60.1zm276.8 100c-14.4-9.7-47.6-13.2-73.1-8.4-3.3-24-16.7-44.9-41.1-63.7l-14-9.3-9.3 14c-18.4 27.8-23.4 73.6-3.7 103.8-8.7 4.7-25.8 11.1-48.4 10.7H2.4c-7.6 42.6-1.2 98.5 27.2 137.2 30.3 41.4 75 62.2 133 62.2 127.3 0 221.1-58.7 265-164.6 17.4 .3 54.6 .3 73.7-36.5 1.2-2.1 4.9-12.3 6-16.1l1.8-5.5-11.2-7.8z" />
    </svg>
  );
}

function LogoOpenFoodFacts({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 48" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Open Food Facts</title>
      <path d="m16.56 8.32c-9.14 0-16.56 7.41-16.56 16.55h33.12c0-9.14-7.41-16.55-16.56-16.55zm5.61 4.95q0.18 0 0.35 0.07 0.17 0.07 0.29 0.2 0.13 0.13 0.2 0.29 0.07 0.17 0.07 0.35 0 0.18-0.07 0.35-0.07 0.17-0.2 0.29-0.12 0.13-0.29 0.2-0.17 0.07-0.35 0.07-0.18 0-0.35-0.07-0.16-0.07-0.29-0.19-0.13-0.13-0.2-0.3-0.07-0.17-0.07-0.35 0-0.18 0.07-0.35 0.07-0.16 0.2-0.29 0.13-0.13 0.29-0.2 0.17-0.07 0.35-0.07zm4.44 4.07q0.18 0 0.34 0.07 0.17 0.07 0.3 0.2 0.13 0.13 0.2 0.29 0.07 0.17 0.07 0.35 0 0.18-0.07 0.35-0.07 0.17-0.2 0.3-0.13 0.12-0.29 0.19-0.17 0.07-0.35 0.07-0.18 0-0.35-0.07-0.17-0.07-0.3-0.19-0.12-0.13-0.19-0.3-0.07-0.17-0.07-0.35 0-0.18 0.07-0.35 0.07-0.16 0.19-0.29 0.13-0.13 0.3-0.2 0.17-0.07 0.35-0.07zm-5.02 1q0.18 0 0.35 0.07 0.16 0.07 0.29 0.2 0.13 0.13 0.2 0.29 0.07 0.17 0.07 0.35 0 0.18-0.07 0.35-0.07 0.16-0.2 0.29-0.13 0.13-0.29 0.2-0.17 0.07-0.35 0.07-0.18 0-0.35-0.07-0.17-0.07-0.29-0.2-0.13-0.12-0.2-0.29-0.07-0.17-0.07-0.35 0-0.18 0.07-0.35 0.07-0.17 0.2-0.29 0.12-0.13 0.29-0.2 0.17-0.07 0.35-0.07z" />
      <path d="m0 24.88c0 6.22 3.45 11.64 8.53 14.48v-0.01l-2.94 7.03 3.87 1.62 2.97-7.09q1.99 0.52 4.14 0.53c9.13 0 16.55-7.43 16.55-16.56h-4.19q-0.01 1.28-0.26 2.49-0.12 0.6-0.3 1.18c-0.96 3.1-3.11 5.67-5.91 7.2q-0.27 0.14-0.54 0.27-0.81 0.39-1.68 0.66-0.29 0.09-0.59 0.17-0.3 0.08-0.6 0.14-1.21 0.25-2.49 0.25-1.28 0-2.49-0.25-0.6-0.12-1.18-0.3-0.01-0.01-0.01-0.01-0.28-0.09-0.57-0.19-0.28-0.1-0.56-0.22-0.27-0.12-0.54-0.25-0.01 0-0.01 0-0.27-0.13-0.53-0.27-0.26-0.15-0.51-0.3c-2.39-1.44-4.24-3.67-5.21-6.32q-0.21-0.57-0.36-1.17-0.14-0.54-0.23-1.11-0.01-0.05-0.02-0.09-0.09-0.62-0.13-1.25-0.01-0.31-0.01-0.63z" />
      <path d="m23.41 0c-3.25 0-6.08 1.82-7.54 4.49 1.12 1.04 1.96 2.37 2.4 3.88 3.79-0.85 6.64-4.19 6.7-8.22q-0.76-0.15-1.56-0.15z" />
      <path d="m10.03 2.18q-0.97 0.01-1.88 0.21c1.04 3.58 4.34 6.2 8.25 6.2q0.97-0.01 1.88-0.21c-1.04-3.58-4.34-6.2-8.25-6.2z" />
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

function LogoTailscale({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="25 27 74 67" width={size} height={size} fill="currentColor" aria-hidden="true">
      <title>Tailscale</title>
      {/* Top row — faded */}
      <circle cx="45.63" cy="40.63" r="6.63" opacity="0.35" />
      <circle cx="65.52" cy="40.63" r="6.63" opacity="0.35" />
      <circle cx="85.41" cy="40.63" r="6.63" opacity="0.35" />
      {/* Middle row — full */}
      <circle cx="45.63" cy="60.52" r="6.63" />
      <circle cx="65.52" cy="60.52" r="6.63" />
      <circle cx="85.41" cy="60.52" r="6.63" />
      {/* Bottom row — mixed */}
      <circle cx="45.63" cy="80.41" r="6.63" opacity="0.35" />
      <circle cx="65.52" cy="80.41" r="6.63" />
      <circle cx="85.41" cy="80.41" r="6.63" opacity="0.35" />
    </svg>
  );
}

function LogoZiaArt({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="10 18 232 108" width={Math.round(size * 1.575)} height={size} fill="currentColor" aria-hidden="true">
      <title>Zia Art</title>
      <path d="M108.49,43.05h7v57.89h-7v21.04h35.02v-21.04h-6.96V43.05h6.96V22.01h-35.02V43.05z M72.32,22.01L57.1,43.05l21.21,0l-42.06,57.89l-21.06,0.01l15.22,21.03l76.87,0v-21.04H64.96l42.33-57.89h0.01V22.01H72.32z M179.69,22.01L179.69,22.01L179.69,22.01l-35,0v99.98h21.06l27.92-38.57l27.91,38.57l15.21-21.03L179.69,22.01z M165.76,86.11V44.84l14.95,20.67L165.76,86.11z" />
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
  { name: 'Docker', href: 'https://www.docker.com/', Logo: LogoDocker },
  { name: 'Open Food Facts', href: 'https://world.openfoodfacts.org/', Logo: LogoOpenFoodFacts },
  { name: 'Cloudflare', href: 'https://www.cloudflare.com/', Logo: LogoCloudflare },
  { name: 'Anthropic', href: 'https://www.anthropic.com/', Logo: LogoAnthropic },
  { name: 'Tailscale', href: 'https://tailscale.com/', Logo: LogoTailscale },
  { name: 'Zia Art', href: 'https://zia-art.com/', Logo: LogoZiaArt },
  { name: 'markup.tips', href: 'https://markup.tips/#stage', Logo: ({ size = 24 }) => <Code size={size} aria-hidden="true" /> },
];

export default function Footer() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [hc, setHC] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('default');

  useEffect(() => {
    setTheme(getThemePreference());
    setHC(getHighContrast());
    setPalette(getExplicitPalette());
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
    <footer rel="contentinfo" className="no-print pt-10 pb-8 px-4 sm:px-6 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="max-w-5xl mx-auto border-t pt-10" style={{ borderColor: 'var(--color-accent-subtle)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-secondary uppercase tracking-wider mb-3">Volume</h3>
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
            <h3 className="font-semibold text-secondary uppercase tracking-wider mb-3">Weight</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 <abbr title="ounce">oz</abbr></dt> <dd className="inline">= 28.35 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="pound">lb</abbr></dt> <dd className="inline">= 16 <abbr title="ounces">oz</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="pound">lb</abbr></dt> <dd className="inline">= 454 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="kilogram">kg</abbr></dt> <dd className="inline">= 2.2 <abbr title="pounds">lb</abbr></dd></div>
              <div><dt className="inline font-medium">1 stick butter</dt> <dd className="inline">= 113 <abbr title="grams">g</abbr></dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-secondary uppercase tracking-wider mb-3">Temperature</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">250 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 121 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">350 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 177 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">400 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 204 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">450 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 232 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">750 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 399 <abbr title="Celsius">°C</abbr></dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-secondary uppercase tracking-wider mb-3">Handy</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 clove garlic</dt> <dd className="inline">≈ 1 <abbr title="teaspoon">tsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 lemon</dt> <dd className="inline">≈ 3 <abbr title="tablespoons">tbsp</abbr> juice</dd></div>
              <div><dt className="inline font-medium">1 lime</dt> <dd className="inline">≈ 2 <abbr title="tablespoons">tbsp</abbr> juice</dd></div>
              <div><dt className="inline font-medium">1 egg</dt> <dd className="inline">≈ 50 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">Pinch</dt> <dd className="inline">≈ ⅛ <abbr title="teaspoon">tsp</abbr></dd></div>
            </dl>
          </div>
        </div>
        <div className="border-t pt-6 mt-2" style={{ borderColor: 'var(--color-accent-subtle)' }}>
          <p className="font-serif font-bold text-sm text-secondary">Pantry Host</p>
          <p className="mt-2 legible text-zinc-500 dark:text-zinc-400 pretty">
            An open source, self-hosted kitchen companion that runs entirely on your home network or mobile&nbsp;device.<br/>Your recipes, your data, your&nbsp;machine.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Accessibility:</span> We strive to meet Level AA of the latest WCAG accessibility guidelines so that Pantry Host is as accessible to everyone as&nbsp;possible.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Privacy:</span> Pantry Host stores all data locally on your machine. Nothing is sent to external servers. No accounts, no tracking, no analytics. If you choose to enable AI features, requests are sent directly to the Anthropic API using your own key and are not stored or used for&nbsp;training.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            Optionally enhanced by <a href="https://claude.ai/download" className="underline text-secondary">Claude&nbsp;Code</a>. Import recipes from any URL, generate new ones from what you have on hand, and manage your pantry conversationally. AI features require an API key and are entirely&nbsp;opt&#8209;in.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Globalization:</span> Pantry Host is currently available in English. We&rsquo;re exploring <a href="https://github.com/jpdevries/pantry-host/discussions/15" className="underline text-secondary" rel="noopener noreferrer nofollow">community&#8209;led translations&nbsp;&mdash; join the&nbsp;discussion</a>.
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
                          ? 'theme-toggle-active'
                          : 'theme-toggle-inactive'
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
                  className="text-xs bg-transparent border border-zinc-300 dark:border-[var(--color-accent-subtle)] rounded px-1.5 py-0.5"
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

          {/* Accessibility preferences link */}
          <a
            href="/accessibility#stage"
            className="mt-3 inline-block text-xs underline text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-text-secondary)]"
          >
            Accessibility Preferences
          </a>

          {/* Credits + GitHub */}
          <div className="mt-6 flex items-start justify-between">
          <details className="credits-details flex-1">
            <summary className="inline-flex items-center gap-1.5 text-xs bg-transparent rounded px-1.5 py-0.5 cursor-pointer select-none hover:underline list-none [&::-webkit-details-marker]:hidden text-zinc-500 dark:text-zinc-400 outline-none">
              Credits
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width={8} height={8} fill="currentColor" aria-hidden="true" className="credits-chevron">
                <path d="M443.5 162.6l-7.1-7.1c-4.7-4.7-12.3-4.7-17 0L224 351 28.5 155.5c-4.7-4.7-12.3-4.7-17 0l-7.1 7.1c-4.7 4.7-4.7 12.3 0 17l211 211.1c4.7 4.7 12.3 4.7 17 0l211-211.1c4.8-4.7 4.8-12.3.1-17z" />
              </svg>
            </summary>
            <div className="credits-grid" style={{ paddingTop: '0.75rem' }}>
              {CREDITS.map(({ name, href, Logo }) => (
                <a key={name} href={href} rel="noopener" className="transition-colors hover:text-secondary" style={{ color: 'inherit' }} aria-label={name} title={name}>
                  <Logo size={28} />
                </a>
              ))}
            </div>
          </details>
            <a href="https://github.com/jpdevries/pantry-host" className="transition-colors hover:text-secondary" style={{ color: 'inherit' }} aria-label="Pantry Host on GitHub">
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
