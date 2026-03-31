import { MagnifyingGlass, ForkKnife, GearSix, TreeStructure, Microphone } from '@phosphor-icons/react';

const capabilities = [
  {
    title: 'Ask your pantry',
    description: 'What ingredients do I have? What\u2019s running low? Filter by category or tags.',
    icon: MagnifyingGlass,
  },
  {
    title: 'Get recipe help',
    description: 'Search recipes by tag or cookware. Generate new ones from what\u2019s on hand. Queue meals for the week.',
    icon: ForkKnife,
  },
  {
    title: 'Manage your kitchen',
    description: 'Add ingredients, create menus, track cookware. Full read/write access to your data.',
    icon: GearSix,
  },
];

/* Client logos from @lobehub/icons-static-svg (MIT license) — stored as path strings for monochrome rendering */
const clients: { name: string; paths?: string[]; viewBox?: string }[] = [
  { name: 'Claude', paths: ['M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z'] },
  // { name: 'ChatGPT', paths: ['M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z'] },
  { name: 'Cursor', paths: ['M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z'] },
  // { name: 'VS Code', paths: ['M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.9119 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z'], viewBox: '0 0 100 100' },
  // { name: 'Windsurf', paths: ['M23.78 5.004h-.228a2.187 2.187 0 00-2.18 2.196v4.912c0 .98-.804 1.775-1.76 1.775a1.818 1.818 0 01-1.472-.773L13.168 5.95a2.197 2.197 0 00-1.81-.95c-1.134 0-2.154.972-2.154 2.173v4.94c0 .98-.797 1.775-1.76 1.775-.57 0-1.136-.289-1.472-.773L.408 5.098C.282 4.918 0 5.007 0 5.228v4.284c0 .216.066.426.188.604l5.475 7.889c.324.466.8.812 1.351.938 1.377.316 2.645-.754 2.645-2.117V11.89c0-.98.787-1.775 1.76-1.775h.002c.586 0 1.135.288 1.472.773l4.972 7.163a2.15 2.15 0 001.81.95c1.158 0 2.151-.973 2.151-2.173v-4.939c0-.98.787-1.775 1.76-1.775h.194c.122 0 .22-.1.22-.222V5.225a.221.221 0 00-.22-.222z'] },
  { name: 'Cline', paths: ['M17.035 3.991c2.75 0 4.98 2.24 4.98 5.003v1.667l1.45 2.896a1.01 1.01 0 01-.002.909l-1.448 2.864v1.668c0 2.762-2.23 5.002-4.98 5.002H7.074c-2.751 0-4.98-2.24-4.98-5.002V17.33l-1.48-2.855a1.01 1.01 0 01-.003-.927l1.482-2.887V8.994c0-2.763 2.23-5.003 4.98-5.003h9.962zM8.265 9.6a2.274 2.274 0 00-2.274 2.274v4.042a2.274 2.274 0 004.547 0v-4.042A2.274 2.274 0 008.265 9.6zm7.326 0a2.274 2.274 0 00-2.274 2.274v4.042a2.274 2.274 0 104.548 0v-4.042A2.274 2.274 0 0015.59 9.6z', 'M12.054 5.558a2.779 2.779 0 100-5.558 2.779 2.779 0 000 5.558z'] },
  { name: 'Zed', paths: ['M9 6C7.34315 6 6 7.34315 6 9V75H0V9C0 4.02944 4.02944 0 9 0H89.3787C93.3878 0 95.3955 4.84715 92.5607 7.68198L43.0551 57.1875H57V51H63V58.6875C63 61.1728 60.9853 63.1875 58.5 63.1875H37.0551L26.7426 73.5H73.5V36H79.5V73.5C79.5 76.8137 76.8137 79.5 73.5 79.5H20.7426L10.2426 90H87C88.6569 90 90 88.6569 90 87V21H96V87C96 91.9706 91.9706 96 87 96H6.62132C2.61224 96 0.604504 91.1529 3.43934 88.318L52.7574 39H39V45H33V37.5C33 35.0147 35.0147 33 37.5 33H58.7574L69.2574 22.5H22.5V60H16.5V22.5C16.5 19.1863 19.1863 16.5 22.5 16.5H75.2574L85.7574 6H9Z'], viewBox: '0 0 96 96' },
  { name: 'OpenClaw', paths: ['M16.877 1.912c.58-.27 1.14-.323 1.616-.037a.317.317 0 01-.326.542c-.227-.136-.547-.153-1.022.068-.352.165-.765.45-1.234.866 2.683 1.17 4.4 3.5 5.148 5.921a6.421 6.421 0 00-.704.184c-.578.016-1.174.204-1.502.735-.338.55-.268 1.276.072 2.069l.005.012.007.014c.523 1.045 1.318 1.91 2.2 2.284-.912 3.274-3.44 6.144-5.972 6.988v2.109h-2.11v-2.11c-1.043.417-2.086.01-2.11 0v2.11h-2.11v-2.11c-2.531-.843-5.061-3.713-5.973-6.987.882-.373 1.678-1.238 2.2-2.284l.007-.014.006-.012c.34-.793.41-1.518.071-2.069-.327-.531-.923-.719-1.503-.735a6.409 6.409 0 00-.704-.183c.749-2.421 2.466-4.751 5.149-5.922-.47-.416-.88-.701-1.234-.866-.474-.221-.794-.204-1.021-.068a.318.318 0 01-.435-.109.317.317 0 01.109-.433c.476-.286 1.036-.233 1.615.037.49.229 1.031.628 1.621 1.182A9.924 9.924 0 0112 2.568c1.199 0 2.284.19 3.256.526.59-.554 1.13-.953 1.62-1.182zM8.835 6.577a1.266 1.266 0 100 2.532 1.266 1.266 0 000-2.532zm6.33 0a1.267 1.267 0 100 2.533 1.267 1.267 0 000-2.533z'] },
  { name: 'Home Assistant', paths: ['M229.39 109.153L130.61 10.3725C124.78 4.5425 115.23 4.5425 109.4 10.3725L10.61 109.153C4.78 114.983 0 126.512 0 134.762V224.762C0 233.012 6.75 239.762 15 239.762H107.27L66.64 199.132C64.55 199.852 62.32 200.262 60 200.262C48.7 200.262 39.5 191.062 39.5 179.762C39.5 168.462 48.7 159.262 60 159.262C71.3 159.262 80.5 168.462 80.5 179.762C80.5 182.092 80.09 184.322 79.37 186.412L111 218.042V102.162C104.2 98.8225 99.5 91.8425 99.5 83.7725C99.5 72.4725 108.7 63.2725 120 63.2725C131.3 63.2725 140.5 72.4725 140.5 83.7725C140.5 91.8425 135.8 98.8225 129 102.162V183.432L160.46 151.972C159.84 150.012 159.5 147.932 159.5 145.772C159.5 134.472 168.7 125.272 180 125.272C191.3 125.272 200.5 134.472 200.5 145.772C200.5 157.072 191.3 166.272 180 166.272C177.5 166.272 175.12 165.802 172.91 164.982L129 208.892V239.772H225C233.25 239.772 240 233.022 240 224.772V134.772C240 126.522 235.23 115.002 229.39 109.162V109.153Z'], viewBox: '0 0 240 240' },
];

export default function Integrations() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <TreeStructure size={32} weight="light" />
      </div>
      <h2
        className="text-3xl sm:text-4xl font-bold text-center mb-4"
      >
        Open by&nbsp;Design
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed">
        Pantry&nbsp;Host ships an <abbr title="Model Context Protocol">MCP</abbr> server so any compatible AI&nbsp;client can read and write your kitchen&nbsp;data&nbsp;&mdash; right from your&nbsp;<abbr title="Local Area Network">LAN</abbr>.
      </p>
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {capabilities.map((cap) => (
          <div
            key={cap.title}
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5"
          >
            <div className="mb-3 opacity-60">
              <cap.icon size={24} weight="light" />
            </div>
            <h3
              className="text-xl font-bold mb-2"
            >
              {cap.title}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
              {cap.description}
            </p>
          </div>
        ))}
      </div>
      {/* OpenClaw subsection */}
      <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 sm:p-8 text-center mb-6">
        <div className="flex justify-center mb-3 opacity-60">
          <svg fill="currentColor" viewBox="0 0 24 24" width={28} height={28} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            {clients.find(c => c.name === 'OpenClaw')?.paths?.map((d, i) => <path key={i} d={d} fillRule="evenodd" clipRule="evenodd" />)}
          </svg>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold mb-4">
          Text your&nbsp;pantry
        </h3>
        <a
          href="https://github.com/jpdevries/pantry-host/blob/main/INTEGRATIONS.md#remote-http"
          target="_pantry-host_docs_integrations"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-[var(--color-bg-body)] hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer mb-5"
        >
          Connect via MCP
        </a>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-5">
          Message your kitchen from apps like WhatsApp, Telegram, Discord, Slack, Signal, or iMessage&nbsp;&mdash; or use iOS Siri Shortcuts for hands&#8209;free&nbsp;voice. Connect any agent gateway that supports <abbr title="Model Context Protocol">MCP</abbr>, such as OpenClaw or&nbsp;IronClaw.
        </p>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-1 italic">
          <p>&ldquo;How many eggs do we&nbsp;have?&rdquo;</p>
          <p>&ldquo;What can I make for&nbsp;dinner?&rdquo;</p>
          <p>&ldquo;Add milk to the&nbsp;list.&rdquo;</p>
        </div>
      </div>
      {/* IronClaw + Siri subsection */}
      <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 sm:p-8 text-center mb-6">
        <div className="flex justify-center mb-3 opacity-60">
          <Microphone size={28} weight="light" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold mb-4">
          &ldquo;Hey Siri,&nbsp;Pantry&rdquo;
        </h3>
        <a
          href="https://github.com/jpdevries/pantry-host/blob/main/INTEGRATIONS.md#siri-shortcut-ios-hands-free-with-voice-response"
          target="_pantry-host_docs_ironclaw"
          rel="noopener noreferrer"
          className="inline-block px-5 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-[var(--color-bg-body)] hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer mb-5"
        >
          Set up iOS Shortcut
        </a>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-5">
          Ask Siri about your kitchen and hear the answer spoken&nbsp;back. Fully hands&#8209;free via a lightweight relay on your&nbsp;LAN.
        </p>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-1 italic">
          <p>&ldquo;What&rsquo;s in the&nbsp;freezer?&rdquo;</p>
        </div>
      </div>
      {/* Logos from @lobehub/icons-static-svg (MIT) — rendered monochrome via fill="currentColor" */}
      <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-[var(--color-text-secondary)] mb-6 opacity-60">
        {clients.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5" title={c.name}>
            {c.paths ? (
              <svg fill="currentColor" viewBox={c.viewBox ?? '0 0 24 24'} width={18} height={18} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                {c.paths.map((d, i) => <path key={i} d={d} fillRule="evenodd" clipRule="evenodd" />)}
              </svg>
            ) : null}
            <span className="text-xs whitespace-nowrap">{c.name}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-[var(--color-text-secondary)] mb-12">
        Compatible with any <abbr title="Model Context Protocol">MCP</abbr> client. Runs on your LAN, your data stays&nbsp;home.
      </p>
    </section>
  );
}
