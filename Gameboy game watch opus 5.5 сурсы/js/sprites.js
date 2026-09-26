/* Game & Watch — pixel art (hand-drawn sprite data + procedural scenery) */
(function () {
  'use strict';
  const GW = window.GW;
  const P = GW.P;

  // palette tuned to the LCD photo
  const C = (GW.SMB = {
    sky: '#6888FC', brick: '#C84C0C', pink: '#FCBCB0', black: '#000000', white: '#FCFCFC',
    hill: '#18A010', hillDark: '#005800', bush: '#A0C000', bushDark: '#18A010',
    q: '#FC9838', qDark: '#C84C0C', coin: '#FC9838', coinDark: '#C84C0C', coinHi: '#FCFCFC',
    cloudShade: '#3CBCFC', pipeL: '#A0D010', pipeD: '#18A010',
    ublue: '#0088A8', ubluePale: '#9CE8F0', castle: '#7C7C7C', castleLight: '#BCBCBC',
  });

  const MARIO_PAL = {
    mario: { R: '#E04018', B: '#8C6800', S: '#FCA044' },
    luigi: { R: '#FCFCFC', B: '#18A010', S: '#FCA044' },
    fire: { R: '#FCD8A8', B: '#E04018', S: '#FCA044' },
    star1: { R: '#18A010', B: '#E45C10', S: '#FCFCFC' },
    star2: { R: '#E04018', B: '#FCFCFC', S: '#FCA044' },
    star3: { R: '#000000', B: '#C84C0C', S: '#FCBCB0' },
  };
  GW.MARIO_PAL = MARIO_PAL;

  const D = (GW.SD = {}); // raw sprite rows

  /* ---------------- small Mario (16x16) ---------------- */
  const HEAD = [
    '......RRRRR.....',
    '.....RRRRRRRRR..',
    '.....BBBSSBS....',
    '....BSBSSSBSSS..',
    '....BSBBSSSBSSS.',
    '....BBSSSSBBBB..',
    '......SSSSSSS...',
  ];
  D.m_stand = HEAD.concat([
    '.....BBRBBB.....',
    '....BBBRBBRBBB..',
    '...BBBBRRRRBBBB.',
    '...SSBRSRRSRBSS.',
    '...SSSRRRRRRSSS.',
    '...SSRRRRRRRRSS.',
    '.....RRR..RRR...',
    '....BBB....BBB..',
    '...BBBB....BBBB.',
  ]);
  D.m_walk1 = HEAD.concat([
    '....BBBBRBB.....',
    '..BBBBBBRRBBSSS.',
    '.SSBBBBBRRRRSSS.',
    '.SS..RRRRSRRSS..',
    '.....RRRRRRRR...',
    '....RRRRRRRRRR..',
    '...RRRRR..RRRRR.',
    '..BBBRR....RRBBB',
    '..BBBB.....BBBB.',
  ]);
  D.m_walk2 = HEAD.concat([
    '.....BBRBB......',
    '....BBBRRBBS....',
    '....BBRRSRSSS...',
    '....BBRRRRRSS...',
    '.....RRRRRRR....',
    '.....RRRRRRR....',
    '......RRRRBB....',
    '.....BBBBBBBB...',
    '.....BBBB.......',
  ]);
  D.m_walk3 = HEAD.concat([
    '.....BBRBBB.....',
    '....BBBRBBRB....',
    '...BBBBRRRRBB...',
    '...SSBRSRRSRSS..',
    '...SSRRRRRRRSS..',
    '....RRRRRRRRR...',
    '....RRRR.RRRR...',
    '...BBBB...BBBB..',
    '...BBB.....BBB..',
  ]);
  D.m_jump = [
    '..............SS',
    '......RRRRR..SSS',
    '.....RRRRRRRRRSS',
    '.....BBBSSBS.BBB',
    '....BSBSSSBSSBBB',
    '....BSBBSSSBSSSB',
    '....BBSSSSBBBBB.',
    '......SSSSSSSB..',
    '..BBBBBRBBBRB...',
    '.BBBBBBBRBBBR..B',
    'SSBBBBBBRRRRR..B',
    'SSS.RRBRRSRRSRBB',
    '.S.BRRRRRRRRRRBB',
    '..BBBRRRRRRRRRBB',
    '.BBBRRRRRRR.....',
    '.B..RRRR........',
  ];
  D.m_skid = [
    '......RRRRR.....',
    '.....RRRRRRRRR..',
    '.....BBBSSBS....',
    '....BSBSSSBSSS..',
    '....BSBBSSSBSSS.',
    '....BBSSSSBBBB..',
    '..SS..SSSSSSS...',
    '.SSSBBBRBB......',
    '.SSBBBBRRRBB....',
    '..BBBBRRSRRBB...',
    '...BBRRRRRRRR...',
    '....RRRRRRRRRB..',
    '....RRRRRRRRBBB.',
    '....RRRRRRRBBBB.',
    '.....BBRRR.BBB..',
    '....BBBB........',
  ];
  D.m_dead = [
    '......RRRR......',
    '..SS.RRRRRR.SS..',
    '.SSSRRRRRRRRSSS.',
    '.SSBBSSBBSSBBSS.',
    '..BBSBSSSSBSBB..',
    '..BSSBSSSSBSSB..',
    '...BSSSBBSSSB...',
    '...BBSBBBBSBB...',
    '....SSSSSSSS....',
    '...RRBBBBBBRR...',
    '..BRRBBBBBBRRB..',
    '..BBRRRRRRRRBB..',
    '..BBRSRRRRSRBB..',
    '...BRRRRRRRRB...',
    '....RRRRRRRR....',
    '....BBB..BBB....',
  ];
  D.m_climb1 = [
    '....RRRRR.......',
    '...RRRRRRRRR....',
    '...BBBSSBS.SS...',
    '..BSBSSSBSSSS...',
    '..BSBBSSSBSSSS..',
    '..BBSSSSBBBBSS..',
    '....SSSSSSSBB...',
    '..BBBBRRBBBSS...',
    '.BBBBBRRRBBSS...',
    '.BBBBRRSRRRR....',
    '..BBRRRRRRRRR...',
    '...RRRRRRRRRR...',
    '...RRRRRRR.RRB..',
    '...RRRR....BBB..',
    '..BBBB.....BBB..',
    '..BBB...........',
  ];
  D.m_climb2 = [
    '....RRRRR.......',
    '...RRRRRRRRR....',
    '...BBBSSBS......',
    '..BSBSSSBSSSSS..',
    '..BSBBSSSBSSSS..',
    '..BBSSSSBBBBSS..',
    '....SSSSSSSBB...',
    '..BBBBRRBBBSS...',
    '.BBBBBRRRBBSS...',
    '.BBBBRRSRRRR....',
    '..BBRRRRRRRRRBB.',
    '...RRRRRRRRRBBB.',
    '...RRRRRRRRRBB..',
    '...RRRRRRR......',
    '..BBBBBB........',
    '..BBBB..........',
  ];

  /* ---------------- big Mario (16x32) ---------------- */
  const BHEAD = [
    '......RRRRRR....',
    '....RRRRRRRRRR..',
    '...RRRRRRRRRRRRR',
    '...BBBBSSSBSS...',
    '..BSSBBSSSBSSS..',
    '..BSSBBBSSBSSSS.',
    '..BSSSBBSSSBSSSS',
    '..BBSSSSSSBBBBB.',
    '...BBSSSSSBBBBB.',
    '....SSSSSSSSSS..',
    '.....SSSSSSSS...',
  ];
  D.M_stand = BHEAD.concat([
    '....BBBBRBBB....',
    '...BBBBBRBBBRB..',
    '..BBBBBBRBBBRBB.',
    '.BBBBBBBRRRRRBBB',
    '.BBBBBBRRSRRSRBB',
    '.SSBBBBRRRRRRRSS',
    'SSSSBBRRRRRRRRSS',
    'SSSS.RRRRRRRRRSS',
    '.SS.RRRRRRRRRRR.',
    '....RRRRRRRRRRR.',
    '...RRRRRRRRRRRR.',
    '...RRRRRR.RRRRR.',
    '...RRRRR...RRRR.',
    '...RRRR....RRRR.',
    '...RRRR....RRRR.',
    '...RRRR....RRRR.',
    '...RRR......RRR.',
    '..BBBB.....BBBB.',
    '.BBBBB.....BBBBB',
    'BBBBBB.....BBBBB',
    'BBBBBB.....BBBBB',
  ]);
  D.M_walk1 = BHEAD.concat([
    '....BBBBRBB.....',
    '..BBBBBBRBBBSS..',
    '.BBBBBBBRRRSSSS.',
    'SSBBBBBBRRRRSSS.',
    'SSSBBBBRRSRRSS..',
    'SSS.BBRRRRRRR...',
    '.S..RRRRRRRRR...',
    '....RRRRRRRRRR..',
    '...RRRRRRRRRRRR.',
    '..RRRRRRRRRRRRRR',
    '..RRRRRRR.RRRRRR',
    '.RRRRRRR...RRRRR',
    '.RRRRRR.....RRRR',
    'RRRRRR......RRRR',
    'RRRRR........RRR',
    'RRRR.........RRR',
    'BBB..........BBB',
    'BBBB........BBBB',
    'BBBB........BBBB',
    'BBB.........BBBB',
    '.............BB.',
  ]);
  D.M_walk2 = BHEAD.concat([
    '....BBBBRBB.....',
    '...BBBBBRBBB....',
    '...BBBBBRRBBS...',
    '...BBBBRRSRSSS..',
    '...BBBBRRRRSSS..',
    '...BBBRRRRRSS...',
    '....RRRRRRRRR...',
    '....RRRRRRRRR...',
    '....RRRRRRRRR...',
    '....RRRRRRRRRR..',
    '.....RRRRRRRRR..',
    '.....RRRRRRRRB..',
    '.....RRRRRRBBB..',
    '......RRRR.BBBB.',
    '......RRRR.BBBB.',
    '......RRRR......',
    '......RRRR......',
    '.....BBBBB......',
    '.....BBBBBB.....',
    '.....BBBBBBB....',
    '................',
  ]);
  D.M_walk3 = BHEAD.concat([
    '....BBBBRBBB....',
    '...BBBBBRBBBRB..',
    '..BBBBBBRBBBRBB.',
    '..BBBBBBRRRRRBB.',
    '..SSBBBRRSRRSRS.',
    '.SSSSBBRRRRRRSSS',
    '.SSSSRRRRRRRRSSS',
    '..SS.RRRRRRRRRS.',
    '....RRRRRRRRRRR.',
    '....RRRRRRRRRRR.',
    '...RRRRRR.RRRRR.',
    '...RRRRR...RRRR.',
    '..RRRRR.....RRR.',
    '..RRRR......RRR.',
    '..RRRR......RRR.',
    '..RRR.......RRR.',
    '.BBBB......BBBB.',
    'BBBBB......BBBBB',
    'BBBBB.......BBBB',
    'BBBB.........BB.',
    '................',
  ]);
  D.M_jump = [
    '..............SS',
    '......RRRRRR.SSS',
    '....RRRRRRRRRRSS',
    '...RRRRRRRRRRRRS',
    '...BBBBSSSBSS.BB',
    '..BSSBBSSSBSSSBB',
    '..BSSBBBSSBSSSSB',
    '..BSSSBBSSSBSSSB',
    '..BBSSSSSSBBBBB.',
    '...BBSSSSSBBBBB.',
    '....SSSSSSSSSB..',
    '.....SSSSSSSBB..',
    '..BBBBBBRBBBRB..',
    '.BBBBBBBRBBBRB..',
    'BBBBBBBBRRRRRB..',
    'SSBBBBBRRSRRSR..',
    'SSSBBBRRRRRRRR..',
    'SSS.RRRRRRRRRRR.',
    '.S.RRRRRRRRRRRRB',
    '...RRRRRRRRRRRBB',
    '..RRRRRRRRRRRBBB',
    '..RRRRRRR.RRRBBB',
    '.RRRRRRR...RRBB.',
    '.RRRRRR.....B...',
    '.RRRRR..........',
    '.RRRR...........',
    'BBBB............',
    'BBBBB...........',
    'BBBBB...........',
    '.BBB............',
    '................',
    '................',
  ];
  D.M_skid = BHEAD.concat([
    '..SS.BBBRBB.....',
    '.SSSSBBBRBBB....',
    '.SSSSBBBRRBBB...',
    '..SSBBBRRSRBBB..',
    '...BBBRRRRRRBB..',
    '...BBRRRRRRRRB..',
    '....RRRRRRRRRR..',
    '....RRRRRRRRRRR.',
    '....RRRRRRRRRRR.',
    '....RRRRRRRRRRB.',
    '....RRRRRRRRRBBB',
    '....RRRRRRRRBBBB',
    '.....RRRRRRRBBBB',
    '.....RRRRRR.BBB.',
    '......RRRRR.....',
    '......RRRRR.....',
    '.....BBBBBB.....',
    '....BBBBBBB.....',
    '....BBBBBB......',
    '....BBBB........',
    '................',
  ]);
  D.M_crouch = [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '................', '................',
    '......RRRRRR....',
    '....RRRRRRRRRR..',
    '...RRRRRRRRRRRRR',
    '...BBBBSSSBSS...',
    '..BSSBBSSSBSSS..',
    '..BSSBBBSSBSSSS.',
    '..BSSSBBSSSBSSSS',
    '..BBSSSSSSBBBBB.',
    '...BBSSSSSBBBBB.',
    '..BBBSSSSSSSSB..',
    '.BBBBBRRRRRBBBB.',
    'SSBBBRRSRRSRBBSS',
    'SSSBRRRRRRRRRSSS',
    'SSSRRRRRRRRRRRSS',
    '.RRRRRRRRRRRRRR.',
    '.RRRRRRRRRRRRRR.',
    'RRRRRRR..RRRRRRR',
    'RRRRRR....RRRRRR',
    'BBBBB......BBBBB',
    'BBBBBB....BBBBBB',
    '.BBBBB....BBBBB.',
    '................',
  ];
  D.M_climb1 = [
    '.....RRRRRR.....',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRRR.',
    '..BBBBSSSBSS.SS.',
    '.BSSBBSSSBSSSSS.',
    '.BSSBBBSSBSSSSS.',
    '.BSSSBBSSSBSSSS.',
    '.BBSSSSSSBBBBSS.',
    '..BBSSSSSBBBBB..',
    '...SSSSSSSSSB...',
    '....SSSSSSSBB...',
    '..BBBBBRBBBSS...',
    '.BBBBBBRBBBSS...',
    'BBBBBBBRRRBSS...',
    'BBBBBBRRSRRR....',
    'BBBBBRRRRRRR....',
    '.BBBRRRRRRRRR...',
    '..RRRRRRRRRRR...',
    '..RRRRRRRRRRR...',
    '..RRRRRRRRRRR...',
    '..RRRRRRRRRRR...',
    '..RRRRRR.RRRR...',
    '..RRRRR...RRRR..',
    '..RRRRR...RRRBB.',
    '..RRRR....RRBBB.',
    '..RRRR.....BBBB.',
    '..RRRR.....BBB..',
    '.BBBBB..........',
    'BBBBBB..........',
    'BBBBBB..........',
    'BBBBB...........',
    '................',
  ];
  D.M_climb2 = D.M_climb1.map((r, i) => (i < 21 ? r : [
    '..RRRRRRRRRRRBB.', '..RRRRRRRRRRBBB.', '..RRRRRRRRRBBBB.', '..RRRRRRRR.BBB..',
    '..RRRRRRR.......', '..RRRRRR........', '..RRRRRR........', '.BBBBBB.........',
    'BBBBBBB.........', 'BBBBBB..........', '................',
  ][i - 21]));
  D.M_dead = D.m_dead;

  /* ---------------- enemies ---------------- */
  D.goomba = [
    '......BBBB......',
    '.....BBBBBB.....',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBKKBBBBKKBB..',
    '.BBBBKKBBKKBBBB.',
    '.BBBPPKBBKPPBBB.',
    'BBBBPPKBBKPPBBBB',
    'BBBBPPPBBPPPBBBB',
    'BBBBBBBBBBBBBBBB',
    '.BBBBPPPPPPBBBB.',
    '....PPPPPPPP....',
    '...KKPPPPPPPP...',
    '..KKKKKPPPPPKK..',
    '..KKKKKKPPPKKKK.',
    '...KKKKK..KKKK..',
  ];
  D.goomba_flat = [
    '....BBBBBBBB....',
    '..BBKKBBBBKKBB..',
    '.BBBPPKBBKPPBBB.',
    'BBBBBBBBBBBBBBBB',
    '.BBBPPPPPPPPBBB.',
    '..KKKKK..KKKKK..',
    '.KKKKKK..KKKKKK.',
    '................',
  ];
  const KHEAD = [
    '..OO............',
    '.OOOO...........',
    '.OWWO...........',
    'OOWKO...........',
    'OOWKOO..........',
    'OOOOOO..........',
    '.OOOOO..........',
    '..OOOO..........',
    '..OOOO..GGGG....',
    '..OOOO.GGWWGG...',
    '..OOOOGGWGGWGG..',
    '...OOGWGGGGGWGG.',
    '...OOGWGGGGGGWG.',
    '...OOWGGGGGGGWGG',
    '...OWWGGGGGGGWGG',
    '...OWGWGGGGGWGWG',
    '...WWGGWWWWWGGWG',
    '..WWWWGGGGGGGWW.',
    '..WWWWWWWWWWWWW.',
    '...WWWWWWWWWWW..',
  ];
  D.koopa1 = KHEAD.concat(['....OOO...OOOO..', '...OOOO...OOOOO.', '..OOOOOO..OOOOOO', '................']);
  D.koopa2 = KHEAD.concat(['.....OOO.OOO....', '....OOOO.OOOO...', '...OOOOO.OOOOO..', '................']);
  D.shell = [
    '................',
    '................',
    '......GGGG......',
    '....GGWWWWGG....',
    '...GWGGGGGGWG...',
    '..GWGGGGGGGGWG..',
    '..GWGGGGGGGGWG..',
    '.GWGGGGGGGGGGWG.',
    '.GWWGGGGGGGGWWG.',
    '.GGWWWWWWWWWWGG.',
    'GWGGGGGGGGGGGGWG',
    'WWWWWWWWWWWWWWWW',
    '.WWWWWWWWWWWWWW.',
    '..WWWWWWWWWWWW..',
    '................',
    '................',
  ];
  D.shell_wake = D.shell.slice(0, 13).concat(['.OOWWWWWWWWWWOO.', 'OOO..........OOO', '................']);

  /* ---------------- items ---------------- */
  D.mushroom = [
    '......CCCC......',
    '.....CCWWCC.....',
    '....CCWWWWCC....',
    '...CCCWWWWCCC...',
    '..CCCCCWWCCCCC..',
    '.CWWCCCCCCCCWWC.',
    '.WWWWCCCCCCWWWW.',
    'CWWWWCCCCCCWWWWC',
    'CWWWWCCCCCCWWWWC',
    'CCWWCCCCCCCCWWCC',
    '.CCCCCCCCCCCCCC.',
    '..SSSKSSSSKSSS..',
    '..SSSKSSSSKSSS..',
    '..SSSSSSSSSSSS..',
    '...SSSSSSSSSS...',
    '....SSSSSSSS....',
  ];
  D.flower = [
    '......OOOO......',
    '...OOOIIIIOOO...',
    '.OOIIIWWWWIIIOO.',
    'OOIIWWWWWWWWIIOO',
    '.OOIIIWWWWIIIOO.',
    '...OOOIIIIOOO...',
    '......OOOO......',
    '.......GG.......',
    '.LL....GG....LL.',
    'LLLL...GG...LLLL',
    'LLLLL..GG..LLLLL',
    '.LLLLL.GG.LLLLL.',
    '..LLLLLGGLLLLL..',
    '...LLLLGGLLLL...',
    '.......GG.......',
    '.......GG.......',
  ];
  D.star = [
    '.......YY.......',
    '.......YY.......',
    '......YYYY......',
    '......YYYY......',
    'YYYYYYYYYYYYYYYY',
    '.YYYYYYYYYYYYYY.',
    '..YYYYKYYKYYYY..',
    '...YYYKYYKYYY...',
    '....YYKYYKYY....',
    '....YYYYYYYY....',
    '...YYYYYYYYYY...',
    '...YYYYYYYYYY...',
    '..YYYYY..YYYYY..',
    '..YYYY....YYYY..',
    '.YYY........YYY.',
    '.Y............Y.',
  ];
  D.coin = [
    '................',
    '......OOOO......',
    '.....OYYYYO.....',
    '....OYYWWYYO....',
    '....OYWYYOYO....',
    '....OYWYYOYO....',
    '....OYWYYOYO....',
    '....OYWYYOYO....',
    '....OYWYYOYO....',
    '....OYWYYOYO....',
    '....OYWYYOYO....',
    '....OYYOOYYO....',
    '.....OYYYYO.....',
    '......OOOO......',
    '................',
    '................',
  ];
  D.hudcoin = ['.YYY.', 'YYWYO', 'YYWYO', 'YYWYO', 'YYWYO', 'YYWYO', 'YYWYO', '.OOO.'];
  D.debris = ['..BBBB..', '.BBBBBB.', 'BBBKBBBB', 'BBBBBBKB', 'BKBBBBBB', 'BBBBKBBB', '.BBBBBB.', '..BBBB..'];
  D.cursor = ['..RRRR..', '.RRWWRR.', 'RWWRRWWR', 'RRRRRRRR', '.SSKKSS.', '.SSSSSS.', '..SSSS..', '........'];
  D.flag = [
    'WWWWWWWWWWWWWWWW',
    '.WWWWWWWWWWWWWWW',
    '..WWWWWWGGGWWWWW',
    '...WWWWGGGGGWWWW',
    '....WWGGWGWGGWWW',
    '.....WGGGGGGGWWW',
    '......WGWGWGWWWW',
    '.......WWWWWWWWW',
    '........WWWWWWWW',
    '.........WWWWWWW',
    '..........WWWWWW',
    '...........WWWWW',
    '............WWWW',
    '.............WWW',
    '..............WW',
    '...............W',
  ];

  /* ---------------- tiles (16x16) ---------------- */
  D.t_brick = [
    'PPPPPPPPPPPPPPPP',
    'BBBBBBBKBBBBBBBK',
    'BBBBBBBKBBBBBBBK',
    'KKKKKKKKKKKKKKKK',
    'BBBKBBBBBBBKBBBB',
    'BBBKBBBBBBBKBBBB',
    'BBBKBBBBBBBKBBBB',
    'KKKKKKKKKKKKKKKK',
    'BBBBBBBKBBBBBBBK',
    'BBBBBBBKBBBBBBBK',
    'BBBBBBBKBBBBBBBK',
    'KKKKKKKKKKKKKKKK',
    'BBBKBBBBBBBKBBBB',
    'BBBKBBBBBBBKBBBB',
    'BBBKBBBBBBBKBBBB',
    'KKKKKKKKKKKKKKKK',
  ];
  D.t_ground = [
    'PPPPPPPPPKPPPPPB',
    'PBBBBBBBBKPBBBBK',
    'PBBBBBBBBKPBBBBK',
    'PBBBBBBBBKPBBBBK',
    'PBBBBBBBBKPBBBBK',
    'PBBBBBBBBKPKBBBK',
    'PBBBBBBBBKPKKKKB',
    'PBBBBBBBBKPPPPPK',
    'PBBBBBBBBKPBBBBK',
    'PBBBBBBBBKPBBBBK',
    'KKBBBBBBKPBBBBBK',
    'PPKKBBBBKPBBBBBK',
    'PBPPKKKKPBBBBBBK',
    'PBBBPPPKPBBBBBBK',
    'PBBBBBBKPBBBBBKK',
    'BKKKKKKKBKKKKKKB',
  ];
  D.t_hard = [
    'PPPPPPPPPPPPPPPB',
    'PPPPPPPPPPPPPPBK',
    'PPPPPPPPPPPPPBKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPPBBBBBBBBBBKKK',
    'PPBKKKKKKKKKKKKK',
    'PBKKKKKKKKKKKKKK',
    'BKKKKKKKKKKKKKKK',
  ];
  D.t_q = [
    '.MMMMMMMMMMMMMM.',
    'MQQQQQQQQQQQQQQK',
    'MQKQQQQQQQQQQKQK',
    'MQQQQMMMMMQQQQQK',
    'MQQQMMKKKMMQQQQK',
    'MQQQMMKQQMMKQQQK',
    'MQQQMMKQQMMKQQQK',
    'MQQQQKKQMMMKQQQK',
    'MQQQQQQMMKKKQQQK',
    'MQQQQQQMMKQQQQQK',
    'MQQQQQQQKKQQQQQK',
    'MQQQQQQMMQQQQQQK',
    'MQQQQQQMMKQQQQQK',
    'MQKQQQQQKKQQQKQK',
    'MQQQQQQQQQQQQQQK',
    'KKKKKKKKKKKKKKKK',
  ];
  D.t_used = [
    '.KKKKKKKKKKKKKK.',
    'KBBBBBBBBBBBBBBK',
    'KBKBBBBBBBBBBKBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBBBBBBBBBBBBBBK',
    'KBKBBBBBBBBBBKBK',
    'KBBBBBBBBBBBBBBK',
    '.KKKKKKKKKKKKKK.',
  ];

  /* ---------------- build ---------------- */
  const S = (GW.S = {});
  const check = (name, rows) => {
    const w = rows[0].length;
    rows.forEach((r, i) => { if (r.length !== w) console.warn('sprite', name, 'row', i, 'len', r.length, '!=', w); });
  };
  for (const k of Object.keys(D)) check(k, D[k]);

  const MARIO_FRAMES = ['m_stand', 'm_walk1', 'm_walk2', 'm_walk3', 'm_jump', 'm_skid', 'm_dead', 'm_climb1', 'm_climb2',
    'M_stand', 'M_walk1', 'M_walk2', 'M_walk3', 'M_jump', 'M_skid', 'M_crouch', 'M_climb1', 'M_climb2'];
  S.mario = {};
  for (const pal of Object.keys(MARIO_PAL)) {
    S.mario[pal] = {};
    for (const f of MARIO_FRAMES) S.mario[pal][f] = GW.spr(D[f], MARIO_PAL[pal]);
  }

  const goombaPal = { B: C.brick, P: C.pink, K: C.black };
  const goombaPalU = { B: C.ublue, P: C.ubluePale, K: '#003840' };
  S.goomba = GW.spr(D.goomba, goombaPal);
  S.goombaFlat = GW.spr(D.goomba_flat, goombaPal);
  S.goombaU = GW.spr(D.goomba, goombaPalU);
  S.goombaFlatU = GW.spr(D.goomba_flat, goombaPalU);
  const koopaPal = { G: P.green, W: P.white, O: C.q, K: C.black };
  S.koopa1 = GW.spr(D.koopa1, koopaPal);
  S.koopa2 = GW.spr(D.koopa2, koopaPal);
  S.shell = GW.spr(D.shell, koopaPal);
  S.shellWake = GW.spr(D.shell_wake, koopaPal);

  S.mushroom = GW.spr(D.mushroom, { C: '#E04018', W: C.white, S: C.pink, K: C.black });
  S.oneup = GW.spr(D.mushroom, { C: P.green, W: C.white, S: C.pink, K: C.black });
  S.flower = [
    GW.spr(D.flower, { O: '#E04018', I: C.q, W: '#FCFCB0', G: P.green, L: C.pipeL }),
    GW.spr(D.flower, { O: C.q, I: '#FCFCB0', W: '#E04018', G: P.green, L: C.pipeL }),
    GW.spr(D.flower, { O: '#FCFCB0', I: '#E04018', W: C.q, G: P.green, L: C.pipeL }),
    GW.spr(D.flower, { O: '#3CBCFC', I: C.white, W: '#E04018', G: P.green, L: C.pipeL }),
  ];
  S.star = [
    GW.spr(D.star, { Y: '#F8B800', K: C.black }),
    GW.spr(D.star, { Y: '#FCFCB0', K: C.black }),
    GW.spr(D.star, { Y: '#FC9838', K: C.black }),
    GW.spr(D.star, { Y: '#E04018', K: C.black }),
  ];
  const coinPals = [
    { O: C.coinDark, Y: '#F8B800', W: '#FCFCB0' },
    { O: C.coinDark, Y: C.q, W: '#FCD8A8' },
    { O: '#8C3000', Y: C.coinDark, W: C.q },
    { O: C.coinDark, Y: C.q, W: '#FCD8A8' },
  ];
  S.coin = coinPals.map((p) => GW.spr(D.coin, p));
  S.coinU = coinPals.map((p) => GW.spr(D.coin, Object.assign({}, p, { O: '#004858' })));
  S.hudcoin = coinPals.map((p) => GW.spr(D.hudcoin, p));
  S.debris = GW.spr(D.debris, { B: C.brick, K: C.black });
  S.debrisU = GW.spr(D.debris, { B: C.ublue, K: '#002830' });
  S.cursor = GW.spr(D.cursor, { R: '#E04018', W: C.white, S: C.pink, K: C.black });
  S.flag = GW.spr(D.flag, { W: C.white, G: P.green });

  // spinning coin that pops out of a ? block (4 widths)
  S.spin = [8, 5, 2, 5].map((w, i) => GW.blob(16, 16, (x, y) => {
    const dx = (x - 8) / (w / 2 + 0.01), dy = (y - 8) / 7;
    return dx * dx + dy * dy <= 1;
  }, i === 2 ? C.coinDark : '#F8B800', C.coinDark, (x) => (Math.abs(x - 7.5) < 1 && i === 0 ? '#FCFCB0' : null)));

  // tiles with overworld + underground palettes
  const tilePal = { P: C.pink, B: C.brick, K: C.black };
  const tilePalU = { P: C.ubluePale, B: C.ublue, K: '#001820' };
  const tilePalC = { P: C.castleLight, B: C.castle, K: C.black };
  S.tiles = {};
  for (const [set, pal] of [['o', tilePal], ['u', tilePalU], ['c', tilePalC]]) {
    S.tiles[set] = {
      brick: GW.spr(D.t_brick, pal),
      ground: GW.spr(D.t_ground, pal),
      hard: GW.spr(D.t_hard, pal),
      used: GW.spr(D.t_used, { B: set === 'u' ? C.ublue : C.brick, K: C.black }),
    };
  }
  S.q = [C.q, '#E07820', C.qDark, '#E07820'].map((col) => GW.spr(D.t_q, { Q: col, M: C.qDark, K: C.black }));

  /* ---------------- procedural scenery ---------------- */
  // pipe pieces: lip 32x16, body 28 wide
  const LIP = 'KDLLDLLLLLLLLLDLDDLDDDDDDDDDDDDK';
  const BODY = 'KDLLDLLLLLLLLDLDDLDDDDDDDDDK';
  function pipeCols(str, pal) { return str.split('').map((c) => pal[c]); }
  function makePipe(pal) {
    const lipC = pipeCols(LIP, pal), bodyC = pipeCols(BODY, pal);
    const lip = GW.canvasSpr(32, 16, (g) => {
      lipC.forEach((col, x) => { g.fillStyle = col; g.fillRect(x, 0, 1, 16); });
      g.fillStyle = pal.K; g.fillRect(0, 0, 32, 1); g.fillRect(0, 15, 32, 1);
    });
    const body = GW.canvasSpr(32, 16, (g) => {
      bodyC.forEach((col, x) => { g.fillStyle = col; g.fillRect(x + 2, 0, 1, 16); });
    });
    // horizontal (sideways) pipe: mouth faces left
    const sideLip = GW.canvasSpr(16, 32, (g) => {
      lipC.forEach((col, y) => { g.fillStyle = col; g.fillRect(0, y, 16, 1); });
      g.fillStyle = pal.K; g.fillRect(0, 0, 1, 32); g.fillRect(15, 0, 1, 32);
    });
    const sideBody = GW.canvasSpr(16, 32, (g) => {
      bodyC.forEach((col, y) => { g.fillStyle = col; g.fillRect(0, y + 2, 16, 1); });
    });
    return { lip, body, sideLip, sideBody };
  }
  S.pipe = makePipe({ K: C.black, L: C.pipeL, D: C.pipeD });
  S.pipeGrey = makePipe({ K: C.black, L: '#FCFCFC', D: '#7C7C7C' });

  // clouds (n = 1..3 puffs), bushes share the shape
  function puffShape(n, h) {
    const w = 32 + 16 * (n - 1) + 2;
    const circles = [];
    circles.push([9, h - 9, 8]);
    for (let i = 0; i < n; i++) circles.push([17 + i * 16, 10, 10]);
    circles.push([w - 10, h - 9, 8]);
    for (let i = 0; i < n; i++) circles.push([17 + i * 16, h - 8, 9]);
    return { w, h, inside: (x, y) => circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r) };
  }
  S.cloud = [1, 2, 3].map((n) => {
    const s = puffShape(n, 24);
    return GW.blob(s.w, s.h, s.inside, C.white, C.black, (x, y) => (y > 17 && (x % 16 > 3 && x % 16 < 12) ? C.cloudShade : null));
  });
  S.bush = [1, 2, 3].map((n) => {
    const s = puffShape(n, 17);
    return GW.blob(s.w, 17, (x, y) => s.inside(x, y) && y < 17, C.bush, C.bushDark, (x, y) => ((x * 7 + y * 3) % 23 === 0 ? C.bushDark : null));
  });

  function hill(w, h) {
    return GW.blob(w, h, (x, y) => {
      const cx = w / 2;
      const top = 11;
      const dx = Math.abs(x - cx);
      if (y < top) return (x - cx) ** 2 + (y - top) ** 2 <= 11 * 11 && y > 0;
      return dx <= 10.5 + (y - top) * ((cx - 10.5) / (h - top));
    }, C.hill, C.black, (x, y) => {
      const spots = [[w / 2 - 6, 16], [w / 2 + 3, 12], [w / 2 + 7, 22], [w / 2 - 12, 26], [w / 2 + 14, 29]];
      return spots.some(([sx, sy]) => sy < h - 2 && Math.abs(x - sx) <= 1 && y >= sy && y <= sy + 3) ? C.black : null;
    });
  }
  S.hillBig = hill(80, 35);
  S.hillSmall = hill(48, 19);

  // castle (5x5 tiles = 80x80), small one
  S.castle = GW.canvasSpr(80, 80, (g) => {
    const brick = (x, y, w, h) => {
      g.fillStyle = C.brick; g.fillRect(x, y, w, h);
      g.fillStyle = C.black;
      for (let yy = y + 7; yy < y + h; yy += 8) g.fillRect(x, yy, w, 1);
      for (let yy = y, row = 0; yy < y + h; yy += 8, row++) {
        for (let xx = x + (row % 2 ? 4 : 0); xx < x + w; xx += 8) g.fillRect(xx, yy, 1, 7);
      }
      g.fillStyle = C.pink;
      for (let yy = y; yy < y + h; yy += 8) g.fillRect(x, yy, w, 1);
    };
    const crenel = (x, y, n) => {
      for (let i = 0; i < n; i++) {
        brick(x + i * 16, y, 16, 8);
        g.fillStyle = 'rgba(0,0,0,0)';
      }
      for (let i = 0; i < n; i++) { g.clearRect(x + i * 16 + 5, y, 6, 4); }
    };
    brick(16, 16, 48, 32);   // upper tower
    brick(0, 40, 80, 40);    // base
    crenel(16, 8, 3);
    crenel(0, 32, 5);
    g.clearRect(16, 32, 48, 8);
    brick(16, 32, 48, 8);
    // windows & door
    g.fillStyle = C.black;
    g.fillRect(24, 20, 8, 14); g.fillRect(48, 20, 8, 14);
    g.fillRect(32, 56, 16, 24);
    g.beginPath(); g.arc(40, 56, 8, Math.PI, 0); g.fill();
  });

  // flagpole ball
  S.poleTop = GW.blob(8, 8, (x, y) => (x - 4) ** 2 + (y - 4) ** 2 <= 16, P.green, C.black, (x, y) => (x < 4 && y < 4 ? C.pipeL : null));

  // Game & Watch LCD-style Mario (monochrome), used by Ball
  D.lcd_mario = [
    '.....#####......',
    '...#########....',
    '...###..#.#.....',
    '..#.#...#...#...',
    '..#.##...#...#..',
    '..##....####....',
    '....#.......#...',
    '.....#######....',
    '....##..#.##....',
    '...###..####....',
    '..#####...###...',
    '..####.....###..',
    '...##.#...#.#...',
    '...#..#####.....',
    '...#.#######....',
    '....########....',
    '....###..###....',
    '...###....###...',
    '..####....####..',
    '..####....####..',
  ];
})();
