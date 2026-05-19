const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# >>> KariGo Firebase static pods <<<';

const SNIPPET = `${MARKER}
static_frameworks = [
  'FirebaseAuthInterop',
  'FirebaseAppCheckInterop',
  'FirebaseCore',
  'FirebaseCoreExtension',
  'GoogleUtilities',
  'RecaptchaInterop',
  'FirebaseInstallations',
  'GoogleDataTransport',
  'nanopb',
  'FirebaseABTesting',
  'FirebaseAuth',
]

pre_install do |installer|
  installer.pod_targets.each do |pod|
    if static_frameworks.include?(pod.name)
      puts "Configuring #{pod.name} as static framework"
      def pod.build_type
        Pod::BuildType.new(:linkage => :static, :packaging => :framework)
      end
    end
  end
end
# <<< KariGo Firebase static pods >>>
`;

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes(MARKER)) return cfg;
      contents = contents.replace(
        /platform :ios.*\n/,
        (m) => `${m}\n${SNIPPET}\n`,
      );
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
