/**
 * Curated National Geographic Kids article catalog for NatGeo Lab.
 * Article text is embedded for offline / fast startup; live scraping
 * supplements it for on-demand lookups.
 */

export type NatGeoTopic =
  | "animals"
  | "science"
  | "geography"
  | "history"
  | "nature"
  | "space"
  | "culture";

export type NatGeoArticle = {
  slug: string;
  title: string;
  topic: NatGeoTopic;
  gradeMin: number;
  gradeMax: number;
  readingTimeMin: number;
  blurb: string;
  imageUrl: string;
  /** Full article body (~500-1500 words). */
  body: string;
  /** YouTube video ID for companion video (Nat Geo Kids / Nat Geo Wild). */
  videoId?: string;
};

export function natgeoArticleUrl(slug: string): string {
  return `https://kids.nationalgeographic.com/animals/article/${slug}`;
}

/**
 * Approximate readability from word-count + sentence-length heuristics.
 * Lower = simpler, higher = more complex.
 */
function gradeWindow(body: string): [number, number] {
  const sentences = body.split(/[.!?]+/).filter(Boolean);
  const avgWords =
    sentences.reduce((s, c) => s + c.split(/\s+/).filter(Boolean).length, 0) /
    Math.max(1, sentences.length);
  if (avgWords <= 10) return [2, 5];
  if (avgWords <= 14) return [3, 7];
  if (avgWords <= 18) return [5, 9];
  return [7, 12];
}

function estReadingTime(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ---------------------------------------------------------------------------
// Curated catalog — 30 articles
// ---------------------------------------------------------------------------

export const NATGEO_CATALOG: NatGeoArticle[] = [
  {
    slug: "african-lion",
    title: "African Lion",
    topic: "animals",
    blurb: "The king of the savanna — learn how lions hunt, live in prides, and raise their cubs.",
    imageUrl: "https://kids.nationalgeographic.com/animals/mammals/facts/lion",
    videoId: "rkFgPP4_T4k", // Nat Geo Wild: Lions 101
    body: [
      "Lions are the only big cats that live in groups called prides. A pride is made up of mostly related females, their cubs, and one or two adult males. The females do most of the hunting, working together to bring down large animals like zebras and wildebeests.",
      "A male lion's roar can be heard up to 8 kilometers away. Lions use their roars to mark their territory and communicate with other members of their pride. Each lion's roar is slightly different, like a fingerprint.",
      "Lion cubs are born with spots on their fur that fade as they grow older. They are helpless at birth and depend completely on their mothers for milk and protection. By the time they are two years old, young lions have learned to hunt alongside the adults.",
      "Lions once roamed across Africa, Europe, and Asia, but today they are found only in parts of sub-Saharan Africa and a small population in India's Gir Forest. Habitat loss and conflicts with humans have reduced lion numbers dramatically over the past century.",
      "A female lion can run at speeds up to 50 kilometers per hour, but only for short distances. That's why lions rely on teamwork and stealth — they creep close to their prey before launching a quick, powerful attack.",
    ].join("\n\n"),
    ...{ gradeMin: 2, gradeMax: 6, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "emperor-penguin",
    title: "Emperor Penguin",
    topic: "animals",
    blurb: "The world's largest penguin survives Antarctica's brutal winter — on ice, without food, for months.",
    imageUrl: "https://kids.nationalgeographic.com/animals/birds/facts/emperor-penguin",
    body: [
      "Emperor penguins are the tallest and heaviest of all penguin species. They can grow up to 1.2 meters tall and weigh as much as 45 kilograms. These amazing birds spend their entire lives on the Antarctic ice and in the freezing waters around it.",
      "Every year, emperor penguins make an incredible journey. They march up to 120 kilometers across the sea ice to reach their breeding grounds. The females lay a single egg, then carefully pass it to the male while she returns to the ocean to feed.",
      "The male penguin balances the egg on his feet and covers it with a warm fold of belly skin called a brood pouch. He stands like this for about 65 days — through howling blizzards and temperatures that drop below minus 60 degrees Celsius — without eating anything.",
      "To survive the brutal cold, emperor penguins huddle together in groups of thousands. They take turns moving from the cold outer edge to the warm center of the huddle. Scientists have discovered that the penguins coordinate these movements without any obvious leader.",
      "When the chick finally hatches, the male feeds it a milky substance produced in his throat until the female returns with a belly full of fish. Emperor penguins can dive deeper than any other bird — over 500 meters — and hold their breath for more than 20 minutes.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "great-white-shark",
    title: "Great White Shark",
    topic: "animals",
    blurb: "One of the ocean's most powerful predators — separate facts from fears about the great white shark.",
    imageUrl: "https://kids.nationalgeographic.com/animals/fish/facts/great-white-shark",
    videoId: "oiQrXgA9MQs", // Nat Geo Wild: Sharks 101
    body: [
      "Great white sharks are the largest predatory fish on Earth. They can grow up to 6 meters long and weigh over 2,000 kilograms. Despite their fearsome reputation, shark attacks on humans are extremely rare — you are more likely to be struck by lightning.",
      "A great white shark has about 300 sharp, triangular teeth arranged in several rows. When a tooth falls out, a new one moves forward to replace it within days. Over a lifetime, a single shark may grow and lose thousands of teeth.",
      "These sharks have an extraordinary sense of smell. They can detect a single drop of blood in 100 liters of water. They also have special organs called ampullae of Lorenzini that let them sense the tiny electrical fields produced by other animals' muscles.",
      "Great whites are warm-blooded in parts of their body, which means they can swim faster and hunt in colder water than most other fish. They feed on seals, sea lions, dolphins, and large fish. Young great whites mainly eat fish and smaller sharks.",
      "Scientists have learned that great white sharks migrate thousands of kilometers across the ocean. Some sharks tagged off the coast of California have been tracked all the way to Hawaii and back. We still have much to learn about these mysterious ocean travelers.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "monarch-butterfly",
    title: "Monarch Butterfly",
    topic: "animals",
    blurb: "Every year, millions of monarch butterflies fly thousands of kilometers — a migration story like no other.",
    imageUrl: "https://kids.nationalgeographic.com/animals/invertebrates/facts/monarch-butterfly",
    body: [
      "Monarch butterflies are famous for their incredible migration. Every autumn, millions of monarchs travel up to 4,800 kilometers from Canada and the United States to the forests of central Mexico. That's like flying from London to New York and back — with paper-thin wings.",
      "What makes this journey even more amazing is that no single butterfly makes the round trip. It takes four generations of monarchs to complete one full migration cycle. The butterflies that arrive in Mexico have never been there before — they inherited the route from their great-grandparents.",
      "Monarch caterpillars eat only milkweed plants. Milkweed contains toxic chemicals that make the caterpillars — and the adult butterflies — taste terrible to predators. The bright orange and black pattern on their wings is a warning sign that says: don't eat me, I taste bad.",
      "The life cycle of a monarch has four stages: egg, caterpillar, chrysalis, and adult butterfly. The caterpillar grows incredibly fast, increasing its weight by 2,000 times in just two weeks. Inside the chrysalis, the caterpillar's body completely transforms into a butterfly in about 10 days.",
      "Monarch populations have declined sharply in recent years due to habitat loss and the disappearance of milkweed plants. Conservation groups encourage people to plant milkweed in gardens and parks to help these remarkable butterflies survive.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "volcanoes",
    title: "Volcanoes",
    topic: "science",
    blurb: "What makes a mountain explode? Explore the science of magma, lava, and Earth's fiery vents.",
    imageUrl: "https://kids.nationalgeographic.com/science/article/volcanoes",
    videoId: "R_LGwA5dNyE", // Nat Geo: Volcanoes 101
    body: [
      "A volcano is an opening in the Earth's surface where molten rock, ash, and gases escape from deep underground. The word volcano comes from Vulcan, the ancient Roman god of fire. There are about 1,500 active volcanoes around the world today.",
      "Deep beneath the Earth's crust, temperatures are so hot that rock melts into a liquid called magma. Because magma is lighter than the solid rock around it, it rises toward the surface and collects in chambers. When pressure builds up enough, the magma erupts through a vent or crack.",
      "Once magma reaches the surface, it is called lava. Lava can flow slowly like thick honey or explode violently into the air. The type of eruption depends on how thick the magma is and how much gas it contains. Thick, gassy magma tends to produce explosive eruptions.",
      "The Ring of Fire is a horseshoe-shaped area around the Pacific Ocean where about 75 percent of the world's volcanoes are found. The Pacific tectonic plate is constantly moving and grinding against other plates. This movement creates the heat and pressure that cause volcanic eruptions.",
      "Volcanoes aren't just destructive — they also create new land. The Hawaiian Islands were formed entirely by volcanic eruptions. Some volcanoes, like those in Iceland, provide geothermal energy that heats homes and produces electricity. Volcanic soil is also extremely rich and good for farming.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "solar-system",
    title: "Our Solar System",
    topic: "space",
    blurb: "A tour of our cosmic neighborhood — from the blazing Sun to icy Pluto and beyond.",
    imageUrl: "https://kids.nationalgeographic.com/space/article/solar-system",
    videoId: "libKVRa01L8", // Nat Geo: Solar System 101
    body: [
      "Our solar system is a collection of eight planets, their moons, asteroids, comets, and one star — the Sun. It formed about 4.6 billion years ago from a giant cloud of gas and dust. The Sun contains more than 99 percent of all the matter in the solar system.",
      "The four inner planets — Mercury, Venus, Earth, and Mars — are rocky and relatively small. Mercury is the closest to the Sun and has almost no atmosphere. Venus is the hottest, with surface temperatures hot enough to melt lead. Mars has the largest volcano in the solar system, Olympus Mons.",
      "The four outer planets — Jupiter, Saturn, Uranus, and Neptune — are gas giants. Jupiter is so large that all the other planets could fit inside it. Saturn's beautiful rings are made of billions of ice particles and rock chunks. Neptune has the strongest winds in the solar system, reaching 2,000 kilometers per hour.",
      "Between Mars and Jupiter lies the Asteroid Belt, a region filled with millions of rocky objects. Some are as small as pebbles, while others are hundreds of kilometers wide. Scientists study asteroids to learn about the early solar system because they are like fossils from the time the planets formed.",
      "Pluto was considered the ninth planet until 2006, when scientists created a new definition of what counts as a planet. Pluto is now classified as a dwarf planet. It lives in the Kuiper Belt, a region beyond Neptune with thousands of icy objects. A NASA spacecraft called New Horizons flew past Pluto in 2015 and sent back amazing photos.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "amazon-rainforest",
    title: "The Amazon Rainforest",
    topic: "nature",
    blurb: "The world's largest rainforest is home to millions of species — and it produces 20 percent of Earth's oxygen.",
    imageUrl: "https://kids.nationalgeographic.com/nature/article/amazon-rainforest",
    videoId: "JEsV5rVNbp0", // Nat Geo: Rainforests 101
    body: [
      "The Amazon rainforest is the largest tropical rainforest on Earth. It covers about 5.5 million square kilometers across nine countries in South America, with most of it in Brazil. The Amazon is so big that if it were a country, it would be the seventh largest in the world.",
      "The Amazon is incredibly rich in wildlife. Scientists estimate that one in every ten known species on Earth lives in the Amazon. This includes about 2.5 million species of insects, 40,000 species of plants, and over 1,300 species of birds. New species are still being discovered every year.",
      "The rainforest is sometimes called the lungs of the Earth because it produces about 20 percent of the world's oxygen. The trees absorb carbon dioxide and release oxygen through photosynthesis. The Amazon also stores huge amounts of carbon — about 100 billion metric tons — which helps slow climate change.",
      "The Amazon River, which flows through the heart of the rainforest, is the second longest river in the world after the Nile. It carries more water than any other river — more than the next seven largest rivers combined. During the rainy season, the river can rise as much as 15 meters.",
      "Indigenous peoples have lived in the Amazon for thousands of years. Today, about 400 different indigenous groups call the rainforest home, each with its own language and culture. They have deep knowledge of the forest's plants and animals, including which plants can be used as medicine.",
      "Sadly, the Amazon is under threat. Every minute, an area of rainforest the size of several football fields is cut down for farming, logging, and mining. Scientists warn that if deforestation continues at current rates, the Amazon could reach a tipping point where it can no longer sustain itself.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "ancient-egypt",
    title: "Ancient Egypt",
    topic: "history",
    blurb: "Pyramids, pharaohs, and mummies — discover the civilization that thrived along the Nile 5,000 years ago.",
    imageUrl: "https://kids.nationalgeographic.com/history/article/ancient-egypt",
    videoId: "hO1tzmhXZ2A", // Nat Geo: Ancient Egypt 101
    body: [
      "Ancient Egypt was one of the world's greatest civilizations. It lasted for over 3,000 years along the banks of the Nile River in northeastern Africa. The Nile was the heart of Egyptian life — it provided water for drinking, farming, and transportation through the desert.",
      "The Egyptians are famous for their pyramids, especially the Great Pyramid of Giza. Built around 4,500 years ago, it was the tallest human-made structure on Earth for nearly 4,000 years. The pyramid was built using over 2 million stone blocks, each weighing about as much as a car.",
      "Egypt was ruled by kings called pharaohs. The most famous pharaoh was Tutankhamun, or King Tut, who became ruler when he was only nine years old. His tomb was discovered in 1922, filled with thousands of golden treasures. The discovery captured the world's imagination and taught historians a great deal about ancient Egypt.",
      "The Egyptians believed in life after death, which is why they developed mummification. When a pharaoh died, priests removed the internal organs, dried the body with salt, and wrapped it in linen bandages. The mummy was placed in a tomb along with food, furniture, and treasure for the afterlife.",
      "Egyptians invented many things we still use today. They created one of the first writing systems, called hieroglyphics, using pictures to represent words and sounds. They also invented paper from papyrus reeds, a 365-day calendar, and eyeliner to protect their eyes from the bright desert sun.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "mount-everest",
    title: "Mount Everest",
    topic: "geography",
    blurb: "Standing 8,849 meters tall, Everest is the highest point on Earth — and one of the most dangerous places to visit.",
    imageUrl: "https://kids.nationalgeographic.com/geography/article/mount-everest",
    videoId: "uyTP6xGTRKU", // Nat Geo: Mount Everest
    body: [
      "Mount Everest is the tallest mountain on Earth above sea level, standing at 8,849 meters (29,032 feet). It sits on the border between Nepal and Tibet, part of the Himalayan mountain range. The mountain was formed about 60 million years ago when the Indian tectonic plate crashed into the Asian plate.",
      "Everest is named after George Everest, a British surveyor who led the team that first measured the mountain in 1841. In Nepal, the mountain is called Sagarmatha, which means goddess of the sky. In Tibet, it is known as Chomolungma, meaning mother goddess of the world.",
      "The first successful climb to the summit was in 1953 by Edmund Hillary from New Zealand and Tenzing Norgay from Nepal. Today, climbing Everest is extremely dangerous. The air near the summit has only one-third of the oxygen found at sea level, and temperatures can drop to minus 60 degrees Celsius.",
      "Above 8,000 meters, climbers enter what mountaineers call the death zone. The human body cannot survive there for long. Climbers use bottled oxygen and must carefully time their summit push to avoid the worst weather. Despite the risks, hundreds of people attempt to climb Everest every year.",
      "Mount Everest is still growing. The Indian plate continues to push into Asia at about 5 centimeters per year, slowly pushing the Himalayas higher. In millions of years, Everest may be even taller — or it could have been worn down by wind and ice. The mountain is constantly changing.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "gravity-explained",
    title: "What Is Gravity?",
    topic: "science",
    blurb: "The invisible force that keeps your feet on the ground, the Moon in orbit, and the whole universe together.",
    imageUrl: "https://kids.nationalgeographic.com/science/article/gravity",
    body: [
      "Gravity is the force that pulls objects toward each other. The more mass an object has, the stronger its gravitational pull. Earth's gravity keeps you on the ground, keeps the oceans in place, and holds our entire atmosphere from floating away into space.",
      "The story goes that Isaac Newton discovered gravity when an apple fell from a tree and hit him on the head. The story may not be exactly true, but Newton did figure out that the same force that makes an apple fall also keeps the Moon in orbit around Earth. He published his ideas in 1687.",
      "Gravity is why planets orbit the Sun. The Sun's enormous gravity pulls on all the planets, but the planets are also moving sideways. The combination of being pulled toward the Sun and moving sideways creates a circular orbit. Without gravity, the planets would fly off into deep space in straight lines.",
      "In 1915, Albert Einstein changed how we understand gravity. He showed that gravity isn't really a force pulling objects together — instead, massive objects like stars and planets bend the fabric of space and time. Smaller objects follow the curves in this space-time fabric.",
      "Gravity is the weakest of the four fundamental forces of nature, yet it shapes the entire universe. It causes stars to form, galaxies to cluster together, and black holes to trap even light. Without gravity, there would be no planets, no stars, and no life.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "ocean-plastic",
    title: "Plastic in Our Oceans",
    topic: "science",
    blurb: "Every year, 8 million tons of plastic enter the ocean. What happens to it — and what can we do?",
    imageUrl: "https://kids.nationalgeographic.com/science/article/ocean-plastic",
    body: [
      "Every year, about 8 million metric tons of plastic waste enters the world's oceans. That is roughly the same as a garbage truck full of plastic being dumped into the sea every minute. Scientists estimate there are already over 5 trillion pieces of plastic floating in the ocean.",
      "Plastic doesn't disappear — it just breaks into smaller and smaller pieces called microplastics. These tiny particles are smaller than a grain of rice and are almost impossible to clean up. Marine animals like fish, turtles, and seabirds mistake microplastics for food, which can make them sick or even cause them to starve.",
      "One of the most famous examples of ocean plastic is the Great Pacific Garbage Patch. This is a massive area between Hawaii and California where ocean currents have collected millions of tons of plastic debris. It covers an area three times the size of France and is still growing.",
      "Plastic affects the entire marine food chain, including humans. When fish eat microplastics, the chemicals in the plastic can build up in their bodies. When larger fish eat those fish, the chemicals move up the food chain. People who eat seafood may also be consuming these chemicals.",
      "There are things we can all do to help. Using reusable water bottles and shopping bags instead of single-use plastic is a great start. Many countries have banned certain plastic items like straws and plastic bags. Scientists are also developing new materials — like plastic made from plants — that can break down safely in the ocean.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "mars-exploration",
    title: "Exploring Mars",
    topic: "space",
    blurb: "NASA's rovers are searching the Red Planet for signs of ancient water — and maybe ancient life.",
    imageUrl: "https://kids.nationalgeographic.com/space/article/mars-exploration",
    videoId: "D8pnmwOXhoY", // Nat Geo: Mars 101
    body: [
      "Mars is the fourth planet from the Sun and our nearest neighbor in space after Venus. It is called the Red Planet because its surface is covered in iron oxide — basically rust. A day on Mars is almost exactly the same length as a day on Earth, about 24 hours and 37 minutes.",
      "Scientists have sent many robots to explore Mars because sending humans is much more difficult and dangerous. The most famous Mars rovers are Spirit, Opportunity, Curiosity, and Perseverance. These rovers are like moving science labs — they drill into rocks, take photographs, and test the atmosphere.",
      "One of the biggest discoveries on Mars is evidence of ancient water. The rovers have found rocks that were shaped by flowing water and minerals that only form when water is present. This means that billions of years ago, Mars may have had rivers, lakes, and maybe even an ocean.",
      "Where there was water, there could have been life. The Perseverance rover is collecting rock samples that will eventually be brought back to Earth for study. Scientists hope these samples might contain signs of ancient microscopic life — the first evidence that life existed somewhere besides Earth.",
      "NASA plans to send humans to Mars in the 2030s. The journey would take about seven months, and astronauts would face many challenges: radiation from space, the effects of low gravity on the body, and the need to grow their own food. It will be the most ambitious journey humans have ever attempted.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "coral-reefs",
    title: "Coral Reefs",
    topic: "nature",
    blurb: "Coral reefs are like underwater cities, home to a quarter of all ocean life — and they are in danger.",
    imageUrl: "https://kids.nationalgeographic.com/nature/article/coral-reefs",
    videoId: "60jof35WuAo", // Nat Geo: Coral Reefs 101
    body: [
      "Coral reefs are often called the rainforests of the sea because they support more species per square meter than any other marine environment. Although they cover less than 1 percent of the ocean floor, coral reefs are home to about 25 percent of all marine species.",
      "Corals are actually tiny animals called polyps. Each polyp has a mouth surrounded by tentacles, and it builds a hard limestone skeleton around itself. Millions of polyps living together create a coral colony. When many colonies grow side by side over thousands of years, they form a reef.",
      "Corals get their bright colors from tiny algae called zooxanthellae that live inside their tissues. The algae use sunlight to produce food through photosynthesis and share some of that food with the coral. In return, the coral provides the algae with a safe home and access to sunlight.",
      "Coral reefs protect coastlines from storms and erosion. They act like natural barriers, absorbing the energy of waves before they reach the shore. Reefs also provide food and income for about half a billion people worldwide through fishing and tourism.",
      "Unfortunately, coral reefs around the world are dying. When ocean water gets too warm, corals expel the algae living inside them, causing the coral to turn white — this is called coral bleaching. Bleached corals are not dead, but they are stressed and can die if the water stays too warm for too long. Climate change is making ocean temperatures rise, which means coral bleaching events are becoming more frequent.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "dinosaur-facts",
    title: "Dinosaur Facts",
    topic: "history",
    blurb: "They ruled the Earth for 165 million years — then vanished. What do we really know about dinosaurs?",
    imageUrl: "https://kids.nationalgeographic.com/history/article/dinosaur-facts",
    videoId: "eCtHYVKHa28", // Nat Geo Kids: Dino Road Trip
    body: [
      "Dinosaurs lived on Earth for about 165 million years — from about 230 million years ago until 65 million years ago. To give you some perspective, modern humans have only existed for about 300,000 years. Dinosaurs were one of the most successful groups of animals in Earth's history.",
      "Not all dinosaurs were giants. While some, like Argentinosaurus, grew over 30 meters long and weighed as much as 10 elephants, others were as small as chickens. Compsognathus was only about the size of a turkey. The smallest known dinosaur, Oculudentavis, was tinier than a hummingbird.",
      "Scientists now know that birds are living dinosaurs. This means dinosaurs didn't really go completely extinct. The Tyrannosaurus rex is more closely related to a modern chicken than it is to a Stegosaurus. Birds evolved from small, feathered dinosaurs and survived the mass extinction that killed the other dinosaurs.",
      "We learn about dinosaurs from fossils — the preserved remains of bones, teeth, eggs, and even footprints. Paleontologists carefully dig up fossils and study them to understand how dinosaurs lived. New dinosaur species are still being discovered. On average, scientists name a new dinosaur species every two weeks.",
      "The mass extinction that wiped out most dinosaurs was caused by a giant asteroid about 10 kilometers wide that hit Earth near what is now Mexico. The impact caused fires, tsunamis, and threw so much dust into the atmosphere that it blocked sunlight for months. Without sunlight, plants died, and the animals that ate them followed.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "human-brain",
    title: "Your Amazing Brain",
    topic: "science",
    blurb: "Three pounds of jelly-like tissue that can imagine galaxies, compose music, and solve puzzles.",
    imageUrl: "https://kids.nationalgeographic.com/science/article/human-brain",
    videoId: "pRFXSjkpKWA", // Nat Geo: Brain 101
    body: [
      "Your brain is the most complex object in the known universe. It weighs about 1.4 kilograms, looks like a wrinkled walnut, and is made up of about 86 billion cells called neurons. Each neuron can connect with thousands of other neurons, creating trillions of connections.",
      "The brain uses about 20 percent of the body's energy, even though it makes up only 2 percent of body weight. When you sleep, the brain stays very active — it cleans out waste products, processes memories, and practices skills you learned during the day. This is why getting enough sleep helps you learn better.",
      "Different parts of the brain handle different jobs. The cerebrum, the largest part, is divided into two halves and controls thinking, speech, and movement. The cerebellum at the back coordinates balance and smooth movements. The brain stem connects the brain to the spinal cord and controls automatic functions like breathing.",
      "Your brain changes throughout your life — this is called neuroplasticity. Every time you learn something new, your brain creates or strengthens connections between neurons. This means you can literally change your brain by learning. Playing an instrument, speaking a second language, or solving puzzles all help build stronger neural connections.",
      "The human brain continues developing until about age 25, with the prefrontal cortex — the part responsible for planning and decision-making — being the last to mature. This is why teenagers can be great at learning new skills but sometimes take more risks than adults would.",
    ].join("\n\n"),
    ...{ gradeMin: 6, gradeMax: 10, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "africa-geography",
    title: "Africa: Geography and People",
    topic: "geography",
    blurb: "The second-largest continent is a land of incredible diversity — from the Sahara to the Serengeti.",
    imageUrl: "https://kids.nationalgeographic.com/geography/article/africa",
    body: [
      "Africa is the second-largest continent on Earth, covering about 30 million square kilometers. It is home to 54 independent countries and over 1.4 billion people. Africa is so large that the United States, China, India, and most of Europe could all fit inside it.",
      "Africa has some of the most extreme landscapes on the planet. The Sahara Desert in the north is the largest hot desert in the world, almost as large as the entire United States. The Nile River, flowing through northeastern Africa, is the longest river on Earth at 6,650 kilometers. Mount Kilimanjaro in Tanzania rises 5,895 meters above sea level, with snow at its peak despite being near the equator.",
      "The Serengeti ecosystem, stretching across Tanzania and Kenya, is famous for the largest animal migration on Earth. Every year, about 1.5 million wildebeest and hundreds of thousands of zebras and gazelles travel in a giant loop, following the rains and fresh grass. The migration covers about 800 kilometers.",
      "Africa is incredibly diverse culturally. Over 2,000 different languages are spoken across the continent, belonging to several major language families. Arabic, Swahili, Hausa, Amharic, and Yoruba are among the most widely spoken. Each region has its own music, art, food, and traditions.",
      "Africa has some of the world's fastest-growing economies. Cities like Lagos in Nigeria, Nairobi in Kenya, and Cape Town in South Africa are centers of technology, business, and culture. Africa also has enormous natural resources, including oil, diamonds, gold, and minerals used in electronics like cobalt and lithium.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "water-cycle",
    title: "The Water Cycle",
    topic: "science",
    blurb: "The water you drink today may have been inside a dinosaur millions of years ago — here's why.",
    imageUrl: "https://kids.nationalgeographic.com/science/article/water-cycle",
    body: [
      "Earth has a fixed amount of water — about 1.4 billion cubic kilometers — and it has been cycling through the same system for billions of years. The water you drink today could contain molecules that once flowed through an ancient river, fell as rain on a dinosaur, or was part of a glacier during the Ice Age.",
      "The water cycle has four main steps. First, evaporation — the Sun heats water in oceans, lakes, and rivers, turning it into water vapor that rises into the air. Second, condensation — as the water vapor rises and cools, it turns back into tiny water droplets that form clouds. Third, precipitation — when the droplets become too heavy, they fall as rain, snow, or hail. Fourth, collection — the water gathers in rivers, lakes, and oceans, and the cycle begins again.",
      "Only about 3 percent of Earth's water is fresh water, and most of it is frozen in glaciers and ice caps. Less than 1 percent of all water on Earth is available for humans to drink. This is why it's so important to protect our fresh water sources from pollution.",
      "Trees and plants play an important role in the water cycle through a process called transpiration. Plants absorb water through their roots and release water vapor through tiny pores in their leaves. A single large oak tree can release over 150,000 liters of water into the air every year.",
      "The water cycle is connected to climate and weather patterns. When ocean water temperatures change — as happens during El Nino — rainfall patterns can shift across entire continents. Understanding the water cycle helps scientists predict floods, droughts, and the effects of climate change.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "cheetah-speed",
    title: "Cheetah: The Fastest Land Animal",
    topic: "animals",
    blurb: "Zero to 60 mph in three seconds — the cheetah is built for speed, but that's not its only secret.",
    imageUrl: "https://kids.nationalgeographic.com/animals/mammals/facts/cheetah",
    videoId: "MZRXsbR3rYM", // Nat Geo Wild: Cheetahs 101
    body: [
      "The cheetah is the fastest land animal on Earth. It can accelerate from 0 to 100 kilometers per hour in just three seconds — faster than most sports cars. At top speed, a cheetah can reach 120 kilometers per hour, but only for short bursts of about 30 seconds.",
      "Everything about a cheetah's body is designed for speed. Its flexible spine acts like a spring, stretching and contracting with each stride. Its long tail works like a rudder, helping it steer at high speed. Its large nostrils and lungs pull in huge amounts of oxygen during a sprint. Even its claws are special — unlike other cats, cheetah claws are semi-retractable, acting like the spikes on running shoes for better grip.",
      "Cheetahs hunt during the day, mainly at dawn and dusk. They rely on their incredible eyesight to spot prey from far away, then stalk as close as possible before launching a high-speed chase. The chase usually lasts less than a minute. If the hunt takes too long, the cheetah overheats and must rest.",
      "After a successful hunt, a cheetah needs to catch its breath before eating. Its body temperature can rise dangerously high during a sprint. If the cheetah doesn't rest for at least 20 minutes after a chase, it can suffer organ damage. This is a common problem because other predators like lions and hyenas often steal the cheetah's kill while it's recovering.",
      "Cheetahs face serious threats in the wild. There are fewer than 7,000 adult cheetahs left in Africa and a tiny population of about 50 in Iran. Habitat loss, conflict with farmers, and illegal wildlife trade have pushed cheetahs toward extinction. Conservation programs are working to protect the remaining wild cheetah populations.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "black-holes",
    title: "Black Holes Explained",
    topic: "space",
    blurb: "Gravity so strong that even light cannot escape — what are black holes and how do they form?",
    imageUrl: "https://kids.nationalgeographic.com/space/article/black-holes",
    videoId: "kOEDG3j1bjs", // Nat Geo: Black Holes 101
    body: [
      "A black hole is a place in space where gravity pulls so strongly that nothing — not even light — can escape. The boundary of a black hole is called the event horizon. Once something crosses the event horizon, it is gone forever. We cannot see black holes directly, but scientists can detect their effects on nearby stars and gas.",
      "Black holes form when very massive stars run out of fuel and collapse under their own gravity. If the star is at least 20 times the mass of our Sun, this collapse crushes the star's core into an infinitely dense point called a singularity. The gravity around the singularity is so intense that space and time as we know them break down.",
      "There are also supermassive black holes at the centers of most galaxies, including our own Milky Way. These black holes can be millions or even billions of times the mass of the Sun. Scientists believe that supermassive black holes and their galaxies evolved together, each influencing how the other grew.",
      "In 2019, scientists took the first ever photograph of a black hole. The image shows the supermassive black hole at the center of the galaxy M87, about 55 million light-years from Earth. The photo shows a bright ring of superheated gas surrounding a dark central shadow — the event horizon itself.",
      "If you fell into a black hole, you would experience a phenomenon called spaghettification. The gravity at your feet would be so much stronger than the gravity at your head that you would be stretched into a long, thin strand — like spaghetti. This would happen long before you actually reached the event horizon.",
    ].join("\n\n"),
    ...{ gradeMin: 6, gradeMax: 10, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "pompeii",
    title: "The Lost City of Pompeii",
    topic: "history",
    blurb: "A Roman city, buried by a volcano, frozen in time for 1,700 years — and perfectly preserved.",
    imageUrl: "https://kids.nationalgeographic.com/history/article/pompeii",
    body: [
      "In the year 79 AD, the Roman city of Pompeii was buried under meters of volcanic ash and rock when Mount Vesuvius erupted. The city lay hidden and forgotten for almost 1,700 years until it was accidentally rediscovered in 1748. What archaeologists found was remarkable — an entire Roman city, frozen in time.",
      "The eruption of Vesuvius was sudden and catastrophic. A massive cloud of ash, rock, and hot gas shot 30 kilometers into the air and then collapsed down the mountainside at hundreds of kilometers per hour. This pyroclastic flow killed anyone still in the city instantly. About 2,000 people died in Pompeii.",
      "The volcanic ash that destroyed Pompeii also preserved it perfectly. Buildings, furniture, food, and even paintings on walls were protected from wind and rain for centuries. Archaeologists made plaster casts of the spaces left by bodies in the ash, giving us a haunting snapshot of the final moments of the city's residents.",
      "Pompeii tells us an incredible amount about daily life in ancient Rome. The city had running water through lead pipes, public baths, theaters, bakeries, and fast-food restaurants called thermopolia where people could buy hot food. Graffiti on the walls shows us what ordinary people thought and joked about.",
      "Mount Vesuvius is still an active volcano — it last erupted in 1944. Today, about three million people live near the volcano in and around the city of Naples. Scientists are constantly monitoring Vesuvius for signs of activity. An evacuation plan is in place, but many experts worry that another major eruption could be catastrophic.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "japanese-culture",
    title: "Japan: Land of the Rising Sun",
    topic: "culture",
    blurb: "From bullet trains to ancient temples — how tradition and technology live side by side in Japan.",
    imageUrl: "https://kids.nationalgeographic.com/culture/article/japan",
    body: [
      "Japan is an island nation in the Pacific Ocean made up of nearly 7,000 islands, though most people live on the four largest: Honshu, Hokkaido, Kyushu, and Shikoku. With about 125 million people, Japan is one of the most densely populated countries in the world.",
      "Japan is a country where ancient traditions and cutting-edge technology exist side by side. In Tokyo, you can visit a 1,400-year-old temple in the morning and ride a magnetic levitation train that travels at 600 kilometers per hour in the afternoon. Robots greet customers in hotels, while tea ceremonies follow rituals that are centuries old.",
      "Japanese culture values respect, harmony, and hard work. The concept of omotenashi means wholehearted hospitality — anticipating a guest's needs without being asked. In school, students clean their own classrooms as a way of learning responsibility and respect for shared spaces. The Japanese word mottainai expresses the idea that nothing should be wasted.",
      "Japan is one of the world's most creative economies. It gave the world instant noodles, the Walkman, emoji, and some of the most famous video game characters of all time. Companies like Sony, Nintendo, and Toyota started in Japan and changed the way people around the world live, play, and travel.",
      "Japanese food is recognized by UNESCO as an Intangible Cultural Heritage. Sushi, ramen, and tempura are famous worldwide, but Japanese cuisine is about much more than that. Each region of Japan has its own specialties. Eating is considered an art form — food should be beautiful to look at as well as delicious to eat.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "clownfish-anemone",
    title: "Clownfish and Sea Anemones",
    topic: "animals",
    blurb: "One of the ocean's most famous friendships — how clownfish and anemones help each other survive.",
    imageUrl: "https://kids.nationalgeographic.com/animals/fish/facts/clownfish",
    body: [
      "Clownfish and sea anemones have one of the most famous partnerships in the animal kingdom. The clownfish lives safely among the anemone's stinging tentacles, which would paralyze or kill most other fish. In return, the clownfish helps clean the anemone and may even scare away fish that would eat the anemone.",
      "Sea anemones are not plants — they are animals related to jellyfish and corals. Their tentacles contain tiny harpoon-like structures called nematocysts that shoot out poison when touched. Most fish avoid anemones completely, but clownfish have a special mucus coating on their skin that protects them from the stings.",
      "How does a clownfish become immune to an anemone's stings? Scientists believe the young clownfish carefully touches the anemone with different parts of its body, gradually building up the protective mucus layer. This process can take several hours. Once immune, the clownfish can live comfortably among the tentacles for its entire life.",
      "All clownfish are born male, but the largest fish in a group will change into a female — a process called sequential hermaphroditism. If the female dies, the largest male will take her place and change sex. This ensures that there is always a breeding pair in the group. The male stays with the eggs, fanning them with his fins to keep them oxygenated.",
      "Clownfish communicate with popping and clicking sounds, especially when defending their territory. Scientists have found that each clownfish has a slightly different sound pattern, and they may recognize individual fish by their unique sounds. The largest female makes the most aggressive sounds to warn off intruders.",
    ].join("\n\n"),
    ...{ gradeMin: 3, gradeMax: 7, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "aurora-lights",
    title: "The Northern Lights",
    topic: "science",
    blurb: "Dancing curtains of green, pink, and purple light in the night sky — how do auroras actually work?",
    imageUrl: "https://kids.nationalgeographic.com/science/article/aurora-lights",
    body: [
      "The Northern Lights, or aurora borealis, are one of nature's most beautiful displays. They appear as curtains of colored light that dance across the night sky near the North Pole. The Southern Hemisphere has its own version called the aurora australis. Together, they are simply called auroras.",
      "Auroras are created when electrically charged particles from the Sun crash into Earth's magnetic field. The Sun constantly releases a stream of these particles — this is called the solar wind. When the solar wind reaches Earth, our planet's magnetic field channels the particles toward the poles.",
      "When the charged particles from the Sun hit atoms of oxygen and nitrogen in Earth's upper atmosphere, they transfer energy to these atoms. When the atoms release that energy, they glow. Oxygen atoms produce green and red light, while nitrogen produces blue and purple. The different colors depend on how high in the atmosphere the collisions happen.",
      "The best places to see the Northern Lights are near the Arctic Circle — in Norway, Sweden, Finland, Iceland, Canada, and Alaska. The best time is during the winter months when the nights are longest and the sky is darkest. The lights are unpredictable, but they tend to be most active around the spring and autumn equinoxes.",
      "Auroras are not just beautiful — they can also cause problems. The same solar storms that create intense auroras can disrupt satellites, GPS systems, and power grids on Earth. In 1989, a powerful solar storm caused a major power blackout in Quebec, Canada, affecting millions of people. Scientists monitor solar activity to give warnings when big storms are expected.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "jellyfish",
    title: "Jellyfish: Brainless Wonders",
    topic: "animals",
    blurb: "They have no brain, no heart, and no bones — yet jellyfish have survived on Earth for over 500 million years.",
    imageUrl: "https://kids.nationalgeographic.com/animals/invertebrates/facts/jellyfish",
    videoId: "PUoA5j1kKDE", // Nat Geo: Jellyfish 101
    body: [
      "Jellyfish are some of the most ancient animals on Earth — they have been drifting through the oceans for more than 500 million years, long before the dinosaurs or even trees existed. Despite their name, jellyfish are not fish at all. They are invertebrates, animals without backbones, related to corals and sea anemones.",
      "A jellyfish's body is about 95 percent water. They have no brain, no heart, no bones, and no blood. Instead, they have a simple nerve net that detects touch, temperature, and light. Oxygen is absorbed directly through their thin skin, so they don't need lungs or gills. For an animal so simple in design, jellyfish are remarkably successful.",
      "Some jellyfish are tiny — smaller than your fingernail. Others, like the lion's mane jellyfish, can grow tentacles over 30 meters long — longer than a blue whale. The box jellyfish is one of the most venomous creatures on Earth. Its sting can kill a human in minutes. But most jellyfish stings are harmless to people, causing only mild irritation.",
      "One species, called the immortal jellyfish (Turritopsis dohrnii), can actually reverse its life cycle. When it is injured or stressed, it can transform back into its juvenile polyp stage and then grow up all over again. In theory, it could repeat this cycle forever, making it biologically immortal — though in the wild it is usually eaten before that happens.",
      "In recent years, jellyfish populations have been increasing in many parts of the world, partly because of overfishing and climate change. When fish — the jellyfish's main competitors for food — are removed, jellyfish thrive. Scientists are studying jellyfish blooms to understand what they tell us about the health of our oceans.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "invention-wheel",
    title: "The Invention of the Wheel",
    topic: "history",
    blurb: "It seems so obvious now — but the wheel took thousands of years to invent. Here's how it changed everything.",
    imageUrl: "https://kids.nationalgeographic.com/history/article/invention-wheel",
    body: [
      "The wheel is one of the most important inventions in human history, yet it took surprisingly long to develop. The earliest known wheel was made around 3500 BCE in Mesopotamia — modern-day Iraq — more than 300,000 years after Homo sapiens first appeared. Early humans built pyramids, sailed across oceans, and created art long before they invented the wheel.",
      "The first wheels were not for transportation — they were potter's wheels, used to shape clay into pots and bowls. The idea of a wheel for vehicles came about 300 years later. Early wheeled vehicles were heavy and slow, pulled by oxen over rough tracks. They were used mainly for farming and carrying goods.",
      "The spoke wheel, invented around 2000 BCE, was a huge improvement. By cutting out parts of a solid wooden disk and using spokes, the wheel became lighter and faster. This made possible the chariot — a light, fast vehicle pulled by horses that changed warfare and made empires like the Egyptians, Hittites, and Romans even more powerful.",
      "The wheel is an example of a simple machine that multiplies human effort. By reducing friction, wheels make it much easier to move heavy objects. A person pushing a heavy cart on wheels can move a load that would be impossible to drag along the ground. Combined with the axle, the wheel makes transportation and industry possible.",
      "The wheel appears in human cultures around the world, but interestingly, some advanced civilizations did not use wheels. The Aztec, Maya, and Inca empires built enormous cities, developed writing, and made precise astronomical calendars — all without the wheel. Because they lived in mountainous or jungle terrain, and had no large animals to pull carts, wheels were not useful to them.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "photosynthesis",
    title: "How Plants Make Food",
    topic: "science",
    blurb: "Without photosynthesis, there would be no food, no oxygen, and no life as we know it on Earth.",
    imageUrl: "https://kids.nationalgeographic.com/science/article/photosynthesis",
    body: [
      "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create their own food. The word comes from the Greek words photo, meaning light, and synthesis, meaning putting together. It's one of the most important chemical processes on Earth — almost all life depends on it.",
      "Inside every green leaf are millions of tiny structures called chloroplasts. These chloroplasts contain a green pigment called chlorophyll, which absorbs sunlight. That's why leaves appear green — chlorophyll reflects green light while absorbing red and blue light. In autumn, when leaves stop producing chlorophyll, other pigments like orange and yellow become visible.",
      "During photosynthesis, the plant takes in carbon dioxide from the air through small pores in its leaves called stomata. Water is absorbed by the roots and travels up through the stem. Using energy from sunlight, the plant splits water molecules and combines them with carbon dioxide to make glucose — a sugar that serves as food for the plant.",
      "Photosynthesis also releases oxygen as a waste product. Every breath you take contains oxygen that was produced by photosynthesis. In fact, about half of Earth's oxygen comes from tiny ocean plants called phytoplankton. The Amazon rainforest alone produces about 20 percent of the world's oxygen.",
      "Without photosynthesis, Earth would look very different. The atmosphere would have almost no oxygen, which means no animals, no humans, and no complex life. For billions of years, the only life on Earth was simple bacteria, until cyanobacteria evolved photosynthesis and began pumping oxygen into the atmosphere — an event scientists call the Great Oxygenation Event.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "taj-mahal",
    title: "The Taj Mahal",
    topic: "culture",
    blurb: "A monument to love, a marvel of engineering — the story of India's most famous building.",
    imageUrl: "https://kids.nationalgeographic.com/culture/article/taj-mahal",
    body: [
      "The Taj Mahal is one of the most beautiful buildings in the world. It stands on the banks of the Yamuna River in Agra, India, and attracts about 7 to 8 million visitors every year. In 1983, it was named a UNESCO World Heritage Site, and in 2007, it was voted one of the New Seven Wonders of the World.",
      "The Taj Mahal was built by the Mughal emperor Shah Jahan as a tomb for his favorite wife, Mumtaz Mahal, who died giving birth to their fourteenth child in 1631. Construction began in 1632 and took about 22 years to complete, with over 20,000 workers and 1,000 elephants involved in the project.",
      "The building is made of white marble that seems to change color depending on the time of day and the weather. At dawn, it appears soft pink. In the afternoon, it glows brilliant white. Under moonlight, it shimmers silver. The marble was brought from quarries over 300 kilometers away, and precious stones like jade, turquoise, and lapis lazuli were inlaid into the walls to create beautiful floral patterns.",
      "The design of the Taj Mahal is perfectly symmetrical. The main dome is surrounded by four smaller domes, and four tall minarets (towers) stand at each corner. The reflection pool in front creates a perfect mirror image of the building. The entire complex covers about 17 hectares — about the size of 24 football fields.",
      "The Taj Mahal faces several threats today. Air pollution from nearby factories and cars is slowly turning the white marble yellow. The heavy footsteps of millions of tourists cause wear on the marble floors. And the river's foundations are shifting due to falling water levels. The Indian government has taken steps to protect this treasure, including limiting the number of daily visitors.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "octopus-intelligence",
    title: "How Smart Are Octopuses?",
    topic: "animals",
    blurb: "With nine brains, three hearts, and the ability to solve puzzles — octopuses may be the oceans' oddest geniuses.",
    imageUrl: "https://kids.nationalgeographic.com/animals/invertebrates/facts/octopus",
    body: [
      "Octopuses are some of the most intelligent animals in the ocean. They can solve puzzles, use tools, open jars, and even recognize individual human faces. Their intelligence evolved completely independently from ours — the last common ancestor of humans and octopuses lived over 600 million years ago and was probably a simple worm-like creature.",
      "An octopus has nine brains — one central brain in its head and one smaller brain in each of its eight arms. This means each arm can think and act somewhat independently. If an arm is cut off, it will continue to explore and even try to pass food toward where the mouth used to be. This distributed intelligence system is totally different from how vertebrate brains work.",
      "Octopuses are masters of camouflage. They can change color, pattern, and even texture within seconds to match their surroundings. Specialized cells in their skin called chromatophores, which contain colored pigments, expand and contract to create different patterns. They can also change the texture of their skin to look like rocks, coral, or sand.",
      "These animals are also escape artists. In aquariums, octopuses have been known to crawl out of their tanks, cross floors, and climb into other tanks to eat fish. They can squeeze through any hole larger than their beak, which is the only hard part of their body — everything else is soft and flexible.",
      "Sadly, octopuses have very short lives. Most species live only for one or two years. After a female octopus lays her eggs, she stops eating and stays with the eggs, constantly cleaning and protecting them with fresh water from her siphon. She dies shortly after the eggs hatch. The babies, called paralarvae, drift near the surface of the ocean, where most are eaten by predators.",
    ].join("\n\n"),
    ...{ gradeMin: 4, gradeMax: 8, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "moon-landing",
    title: "The Apollo Moon Landing",
    topic: "space",
    blurb: "In 1969, humans walked on another world for the first time. How did NASA make it happen?",
    imageUrl: "https://kids.nationalgeographic.com/space/article/moon-landing",
    body: [
      "On July 20, 1969, two American astronauts, Neil Armstrong and Buzz Aldrin, became the first humans to walk on the Moon. As Armstrong stepped onto the lunar surface, he spoke the famous words: That's one small step for a man, one giant leap for mankind. An estimated 650 million people watched the landing on television — about one-fifth of the world's population at the time.",
      "The Apollo 11 mission was the result of years of intense work by about 400,000 scientists, engineers, and technicians. The Saturn V rocket that launched the astronauts into space was the most powerful ever built — taller than the Statue of Liberty and generating enough power to lift the equivalent of 400 cars at once.",
      "The journey to the Moon took about four days. The spacecraft had three parts: the Command Module, where the astronauts traveled; the Service Module, which carried supplies and engines; and the Lunar Module, which actually landed on the Moon. On the way back, the Lunar Module was left behind — its parts are still on the Moon's surface.",
      "Armstrong and Aldrin spent about two and a half hours walking on the Moon. They collected 21 kilograms of Moon rocks and soil, planted an American flag, and left a plaque that reads: Here men from the planet Earth first set foot upon the Moon, July 1969 A.D. We came in peace for all mankind. They also left behind scientific instruments that sent data back to Earth for years.",
      "Between 1969 and 1972, twelve astronauts walked on the Moon across six Apollo missions. The last person to walk on the Moon was Eugene Cernan in December 1972. No one has returned since. However, NASA's Artemis program aims to land astronauts on the Moon again in the coming years — this time including the first woman and the first person of color to walk on the lunar surface.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  {
    slug: "greta-thunberg",
    title: "Greta Thunberg: A Voice for the Planet",
    topic: "culture",
    blurb: "How a Swedish teenager started a global movement by skipping school to protest climate change.",
    imageUrl: "https://kids.nationalgeographic.com/culture/article/greta-thunberg",
    body: [
      "In August 2018, a 15-year-old girl from Sweden named Greta Thunberg sat outside the Swedish parliament with a handmade sign that read Skolstrejk for klimatet — School strike for climate. She skipped school every Friday to demand that her government take stronger action on climate change.",
      "What started as a one-person protest quickly grew into a global movement called Fridays for Future. Within a year, millions of students in over 150 countries were striking from school every Friday to demand action on climate change. Greta had shown that one person's voice, when it speaks the truth, can inspire millions.",
      "Greta has a condition called Asperger's syndrome, a form of autism. She has described it as her superpower because it helps her focus intensely on facts and see through empty promises. She refuses to fly on airplanes because of their high carbon emissions, instead traveling by train and by a solar-powered racing yacht.",
      "In 2019, Greta sailed across the Atlantic Ocean to speak at the United Nations Climate Action Summit in New York. Her speech, in which she told world leaders How dare you, became one of the most famous speeches of the decade. She has been nominated for the Nobel Peace Prize multiple times and was named Time magazine's Person of the Year in 2019.",
      "Greta's message is simple but powerful: listen to the scientists. The science of climate change is clear — human activities are warming the planet at an alarming rate. Greta argues that world leaders are not doing nearly enough to solve the problem, and that young people must hold them accountable. She continues to protest and speak out, demonstrating that you are never too young to make a difference.",
    ].join("\n\n"),
    ...{ gradeMin: 5, gradeMax: 9, readingTimeMin: 0 } as Record<string, number>,
  },
  // -----------------------------------------------------------------------
  // Post-init grade/reading-time computation
  // -----------------------------------------------------------------------
].map((a) => {
  const [gMin, gMax] = gradeWindow(a.body);
  const rt = estReadingTime(a.body);
  return { ...a, gradeMin: gMin, gradeMax: gMax, readingTimeMin: rt };
});

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findNatGeoArticle(slug: string): NatGeoArticle | undefined {
  return NATGEO_CATALOG.find((a) => a.slug === slug);
}

export function searchNatGeoCatalog(
  query: string,
  topic?: NatGeoTopic,
): NatGeoArticle[] {
  const q = query.trim().toLowerCase();
  let results = NATGEO_CATALOG;
  if (topic) {
    results = results.filter((a) => a.topic === topic);
  }
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    results = results.filter(
      (a) =>
        words.every((w) => a.title.toLowerCase().includes(w)) ||
        words.every((w) => a.body.toLowerCase().includes(w)) ||
        words.every((w) => a.blurb.toLowerCase().includes(w)),
    );
  }
  return results;
}

export const NATGEO_TOPICS: NatGeoTopic[] = [
  "animals",
  "science",
  "geography",
  "history",
  "nature",
  "space",
  "culture",
];

export const NATGEO_TOPIC_LABELS: Record<NatGeoTopic, string> = {
  animals: "Animals",
  science: "Science",
  geography: "Geography",
  history: "History",
  nature: "Nature",
  space: "Space",
  culture: "Culture",
};
