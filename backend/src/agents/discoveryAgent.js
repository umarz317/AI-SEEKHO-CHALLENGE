// agents/discoveryAgent.js — Agent 3: Provider Discovery
// Finds providers matching the service category and area

const providers = require('../data/providers.mock.json');
const { runWithAdapter, googleStubs } = require('../tools/mode');

/**
 * @param {{ normalizedServiceType: string, locationText: string, city: string }} input
 * @returns {object} discovered providers
 */
async function run(input) {
  const { normalizedServiceType, locationText, city = 'Islamabad' } = input;
  
  const mockImpl = async () => {
    if (!normalizedServiceType) {
      return { providers: [], status: 'no_service_type' };
    }

    // Filter by category
    let matches = providers.filter(p => p.category === normalizedServiceType && p.city.toLowerCase() === city.toLowerCase());

    // If location specified, prioritize those serving that area
    if (locationText) {
      const area = locationText.toUpperCase();
      const inArea = matches.filter(p => p.areasServed.includes(area));
      const outArea = matches.filter(p => !p.areasServed.includes(area));
      matches = [...inArea, ...outArea];
    }

    return {
      providers: matches,
      totalFound: matches.length,
      status: matches.length > 0 ? 'found' : 'no_providers',
    };
  };

  return runWithAdapter('discovery', mockImpl, googleStubs.discovery);
}



module.exports = { run };
