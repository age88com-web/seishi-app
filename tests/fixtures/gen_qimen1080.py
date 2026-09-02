import fitz, re, json
SRC='/Users/goodcamper/Desktop/seishi-app/docs/source/1080.pdf'
d=fitz.open(SRC)
KANJI_NUM={k:i+1 for i,k in enumerate('一二三四五六七八九')}
PALACE8=['坎','艮','震','巽','離','坤','兌','乾']
PAL2NUM={'坎':1,'艮':8,'震':3,'巽':4,'離':9,'坤':2,'兌':7,'乾':6}
STARS=set('蓬任衝輔英芮禽柱心'); MEN=set('休生傷杜景死驚開'); STEMS=set('戊己庚辛壬癸丁丙乙'); SHEN=set('値蛇陰合陳雀地天')
SHEN_FULL={'値':'直符','蛇':'騰蛇','陰':'太陰','合':'六合','陳':'勾陳','雀':'朱雀','地':'九地','天':'九天'}
STAR_FULL={'蓬':'天蓬','任':'天任','衝':'天沖','輔':'天輔','英':'天英','芮':'天芮','禽':'天禽','柱':'天柱','心':'天心'}
MEN_FULL={'休':'休門','生':'生門','傷':'傷門','杜':'杜門','景':'景門','死':'死門','驚':'驚門','開':'開門'}
full='\n'.join(d[i].get_text() for i in range(d.page_count))
toks=[t for t in full.split('\n') if t.strip()]
title_re=re.compile(r'^([陰陽])遁([一二三四五六七八九])局([甲乙丙丁戊己庚辛壬癸])([甲乙丙丁戊己庚辛壬癸])日([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])時$')
vf_re=re.compile(r'^(天.)値符：([一二三四五六七八九])宮(.門)値使：([一二三四五六七八九])宮$')
idx=[i for i,t in enumerate(toks) if title_re.match(t)]
recs=[]
for k,ti in enumerate(idx):
    end=idx[k+1] if k+1<len(idx) else len(toks)
    block=toks[ti:end]; m=title_re.match(block[0])
    dun='陽遁' if m.group(1)=='陽' else '陰遁'; ju=KANJI_NUM[m.group(2)]
    vf=vf_re.match(block[1])
    rec={'no':k+1,'title':block[0],'dun':dun,'ju':ju,'hourStem':m.group(5),'hourBranch':m.group(6),
         'zhifuStar':STAR_FULL[vf.group(1)[1]],'zhifuPalace':KANJI_NUM[vf.group(2)],
         'zhishiMen':vf.group(3),'zhishiPalace':KANJI_NUM[vf.group(4)]}
    chars=[c for c in ''.join(block[2:]) if c not in '0123456789 \t']
    p=0; dipan={}
    for _ in range(8):
        dipan[str(PAL2NUM[chars[p]])]=chars[p+1]; p+=2
    # 中5 = the missing stem
    mid=list(STEMS-set(dipan.values())); assert len(mid)==1
    dipan['5']=mid[0]
    rec['dipan']=dipan
    men_chars=chars[p:p+8]; p+=8
    rec['bamen']={str(PAL2NUM[PALACE8[i]]):MEN_FULL[men_chars[i]] for i in range(8)}
    tp_chars=chars[p:p+9]; p+=9
    shen_chars=chars[p:p+8]; p+=8
    rec['bashen']={str(PAL2NUM[PALACE8[i]]):SHEN_FULL[shen_chars[i]] for i in range(8)}
    tail=chars[-18:]; star_seq=[tail[j+1] for j in range(0,18,2)]
    qpos=star_seq.index('禽')
    outer_stars=[s for i,s in enumerate(star_seq) if i!=qpos]
    jiuxing={PAL2NUM[PALACE8[i]]:[STAR_FULL[outer_stars[i]]] for i in range(8)}
    rui=[pn for pn,l in jiuxing.items() if '天芮' in l][0]
    jiuxing[rui].append('天禽')
    rec['jiuxing']={str(k2):sorted(v) for k2,v in jiuxing.items()}
    rec['jiuxing']['5']=[]
    # 天盤: 外周8 (禽の位置を除去) + 中5 = 中宮地盤干(=禽帯同干)
    tp_outer=[s for i,s in enumerate(tp_chars) if i!=qpos]
    tp={str(PAL2NUM[PALACE8[i]]):tp_outer[i] for i in range(8)}
    tp['5']=tp_chars[qpos]
    assert tp['5']==dipan['5'], (rec['no'], tp['5'], dipan['5'])
    rec['tianpan']=tp
    recs.append(rec)
assert len(recs)==1080
out={
 "_meta": {
  "source": "docs/source/1080.pdf （呉煒維 制作／山道帰一 監修「陰陽遁1080局 奇門遁甲格局総覧」）",
  "description": "1080.pdf から機械的に転記した検証専用 fixture。仕様ではない。奇門遁甲ロジックの逆算・変更には使用しないこと。",
  "extraction": "PyMuPDF によるテキスト抽出。各局の 3x3 完成図から 地盤(8宮)/八門(8宮)/九星(9=8宮+天禽)/八神(8宮) を宮順 [坎,艮,震,巽,離,坤,兌,乾] で読み取り、値符行から 値符星・値符宮・値使門・値使宮 を読み取った。地盤の中宮(5)は残る1干、天盤の中宮(5)は九星行の天禽と同位置の干（=中宮地盤干）。",
  "notes": [
    "天盤は各宮の九星が帯同する六儀三奇干（1080.pdf の完成図2段目）。",
    "旬首(xunShou)は 1080.pdf に明示欄が無いため fixture に含めない。テスト側で時干支から60干支の旬の先頭として算出し照合する。",
    "九星の天禽は天芮と同宮（芮禽表記）。jiuxing では天芮の宮に ['天禽','天芮'] のように併記。",
    "生成スクリプト: tests/fixtures/gen_qimen1080.py"
  ],
  "count": 1080,
  "generatedAt": "2026-09-02"
 },
 "charts": recs
}
json.dump(out, open('/Users/goodcamper/Desktop/seishi-app/tests/fixtures/qimen1080.json','w'), ensure_ascii=False, indent=0)
print('wrote fixture:', len(recs), 'charts')
