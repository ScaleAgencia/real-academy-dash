# =====================================================================
#  REAL ACADEMY - Dashboard de captacao (funil Meta Ads)  -  data engine
#  2 produtos (Growth, Flow) x 2 mecanismos (Typeform, Pop-up) = 4 funis.
#  As queries vem de UMA aba por produto -> divido o gasto por FASE+TAG:
#    campanha com 'typeform' no nome  -> funil Typeform (qualquer data)
#    campanha SEM 'typeform':  dia < POPUP_START -> Typeform ; senao Pop-up
#  Regra confirmada pelo usuario (o Pop-up so nasceu em 30/06; antes disso
#  100% do trafego alimentava o Typeform) -> split disjunto, ZERO duplicacao.
#  Leads: cada aba de lead JA E o funil. Cruza utm x campanha do proprio funil.
#  5a aba: comparativo diario (planilha comercial: invest/leads Meta/leads Clint).
#  Imposto Meta x1,1385 em TODO gasto. Somente leitura. ASCII-only (PS5.1 ANSI).
# =====================================================================
param([ValidateSet('all')][string]$Mode='all')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$BR = [Globalization.CultureInfo]::GetCultureInfo('pt-BR')
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# ---- rules ----------------------------------------------------------
$TAX          = 1.1385          # imposto Meta (+13,85%) em TODO gasto Meta
$POPUP_START  = '2026-06-30'    # dia em que o funil Pop-up comecou a captar
$TYPEFORM_TAG = 'typeform'      # token no nome da campanha = funil Typeform
$QUALIFIED    = @('A','B')      # A = investidor ativo + R$500k+ ; B = investidor ativo (qualquer capital). Qualif = A+B.
$TODAY        = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'E. South America Standard Time').ToString('yyyy-MM-dd')

# ---- sources (read-only) --------------------------------------------
$QUERIES_ID = '1f2sYo1iNC-jzh1nEWfNHYrZN97r8SrTWDuLiZWVRX1o'
$LEADS_ID   = '1zeuazJw-qPmptVxKUuuqLMvsPwc9H0x5MKJliUkaInk'
$COMM_ID    = '1SgXS5bYo7x5pxB8fqIkdUmRd21ojZcZ_xAtrr_c7xvM'

# gid de cada aba
$G_Q_GROWTH   = '0'
$G_Q_FLOW     = '939559412'
$G_L_GROWTH_T = '1827900412'   # Growth - Type
$G_L_GROWTH_P = '1397437224'   # Growth - Popup
$G_L_FLOW_T   = '2043772984'   # Flow - Type
$G_L_FLOW_P   = '2090090056'   # Flow - Popup
$G_C_FLOW     = '2074063048'   # RA FLOW DIARIO
$G_C_GROWTH   = '301064610'    # RA GROWTH DIARIO
$G_Q_BUILD    = '822802163'    # Real-Build (queries)
$G_L_BUILD_P  = '975680576'    # Build - Popup (leads)
$G_C_BUILD    = '573878590'    # RA BUILD DIARIO (comercial: vendas/faturamento)
$BUILD_CUTOFF = 'juliana'      # so conta leads da Juliana p/ baixo (acima dela = testes)
# --- funis novos (add 19/08): Arremate + Experience (standalone Pop-up, igual Build) ---
# ATENCAO: gids conferidos pelo NOME da aba (o usuario colou gids trocados/duplicados). Queries: aba "Arremate"=1170576470, "Real Experience"=1577794962.
$G_Q_ARR      = '1170576470'   # queries aba "Arremate"
$G_Q_EXP      = '1577794962'   # queries aba "Real Experience"
$G_L_ARR_P    = '972106590'    # leads aba "Arremate - Popup"
$G_L_EXP_P    = '1277316158'   # leads aba "Experience - Popup"
$G_C_ARR      = '1284944705'   # comercial "RA ARREMATE DIARIO"
$G_C_EXP      = '1665362188'   # comercial "RA EXPERIENCE"
$G_C_CLUB     = '283417784'    # comercial "Vendas - Real Club" (produto de ascensao vendido nos eventos)

# ---- helpers --------------------------------------------------------
function Get-Sheet($id,$gid,$out,$export){
  # $export=$true -> endpoint /export?format=csv (le a celula como TEXTO cru, sem inferir tipo).
  #   USAR NAS ABAS DE LEADS: o gviz infere o tipo da coluna de data pelas datas antigas e
  #   DESCARTA as datas em formato diferente (ISO "2026-08-24T..:.-03:00" viravam vazio ->
  #   669 leads "sem data" no Experience -> estimativa falsa espalhava ~8/dia). Bug real, ago/2026.
  # $export=$false (gviz) -> mantido p/ queries/comercial (colunas de tipo uniforme, ok).
  #   &headers=1 = FORCA 1 linha de cabecalho (sem isso o gviz colapsa colunas -> sheet "some").
  $url = if($export){ "https://docs.google.com/spreadsheets/d/$id/export?format=csv&gid=$gid" } else { "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&gid=$gid&headers=1" }
  if($env:RA_REUSE -eq '1' -and (Test-Path $out)){ return $out }
  for($try=1;$try -le 4;$try++){
    try{ $wc=New-Object System.Net.WebClient; $wc.Encoding=[Text.Encoding]::UTF8
      $wc.Headers.Add('User-Agent','Mozilla/5.0 realacad-dash'); $wc.DownloadFile($url,$out); $wc.Dispose(); break }
    catch{ if($try -eq 4){ throw }; Start-Sleep -Seconds ([Math]::Pow(2,$try)) }
  }
  if((Get-Item $out).Length -lt 20){ throw "Download muito pequeno: $out" }
  return $out
}
Add-Type -AssemblyName Microsoft.VisualBasic
function Read-Csv($path){
  $rows = New-Object System.Collections.Generic.List[object]
  $p = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($path,[Text.Encoding]::UTF8)
  $p.TextFieldType='Delimited'; $p.SetDelimiters(','); $p.HasFieldsEnclosedInQuotes=$true
  while(-not $p.EndOfData){ try{ $rows.Add($p.ReadFields()) }catch{} }
  $p.Close(); return $rows
}
function Norm($s){ if($null -eq $s){return ''}; return ($s -replace [char]0x200b,'').Trim() }
function MoneyBR($s){ $s=Norm $s; if($s -eq ''){return 0.0}
  $s = $s -replace '[R$\s]',''
  if($s -match ','){ $s = ($s -replace '\.','') -replace ',','.' }
  if($s -notmatch '^-?\d'){ return 0.0 }; return [double]$s }
function ToInt($s){ $s=Norm $s; if($s -eq ''){return 0}; $v=($s -replace '\.','' -replace ',','.'); if($v -notmatch '^-?\d'){return 0}; return [int][double]$v }
function Deacc($s){ if($null -eq $s){return ''}; $s=([string]$s).Normalize([Text.NormalizationForm]::FormD); $sb=New-Object Text.StringBuilder
  foreach($c in $s.ToCharArray()){ if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark){ [void]$sb.Append($c) } }
  return $sb.ToString().ToLowerInvariant().Trim() }
function HdrLike($hdr,$frag){ for($i=0;$i -lt $hdr.Count;$i++){ if((Deacc $hdr[$i]) -like $frag){ return $i } }; return -1 }
# query Day ja vem yyyy-mm-dd ; leads Submitted At 'dd/mm/yyyy HH:MM:SS' ou Created At ISO
function LDate($s){ $s=Norm $s; if($s -eq ''){return ''}
  if($s -match '^(\d{4})-(\d{2})-(\d{2})'){ return "$($Matches[1])-$($Matches[2])-$($Matches[3])" }
  if($s -match '^(\d{1,2})/(\d{1,2})/(\d{4})'){ return ('{0}-{1:D2}-{2:D2}' -f $Matches[3],[int]$Matches[2],[int]$Matches[1]) }
  return '' }
$EPOCH=[datetime]'2025-01-01'
function DToNum($d){ if($d -eq ''){return -1}; return [int](([datetime]::ParseExact($d,'yyyy-MM-dd',$null))-$EPOCH).TotalDays }
function NumToD($num){ return $EPOCH.AddDays($num).ToString('yyyy-MM-dd') }
# leads do pop-up vem com o utm DUPLICADO ("<nome> <nome>" - macro Meta {{campaign.name}} renderizada 2x). Desdobra.
function DeDup($s){ $s=([string]$s).Trim(); $L=$s.Length; if($L -lt 3){ return $s }
  if($L % 2 -eq 1){ $m=($L-1)/2; if($s[$m] -eq ' ' -and $s.Substring(0,$m) -eq $s.Substring($m+1)){ return $s.Substring(0,$m) } }
  if($L % 2 -eq 0){ $m=$L/2; if($s.Substring(0,$m) -eq $s.Substring($m)){ return $s.Substring(0,$m) } }
  return $s }
function CleanUtm($s){ $s=Norm $s; if($s -eq '' -or $s.IndexOf('{{') -ge 0){ return '' }; return (DeDup $s) }

# faixa de capital (pergunta comum aos 2 mecanismos) -> A..E / NS
# Qualificacao (definida pelo usuario 04/08): A = "Sou investidor ativo" + capital >= R$500k (500k-1M OU acima de 1M);
# B = "Sou investidor ativo" (qualquer capital); N = nao qualificado (nao e investidor ativo). Qualificado = A+B.
function TierOf($capRaw,$expRaw){
  if((Deacc $expRaw) -notlike '*investidor ativo*'){ return 'N' }
  $c=Deacc $capRaw
  if($c -like '*500 mil*1 milhao*' -or $c -like '*acima*1 milhao*'){ return 'A' }
  return 'B' }
function IsQualified($tier){ return ($QUALIFIED -contains $tier) }

# ---- name interning (compartilhado) ---------------------------------
$Names = New-Object System.Collections.Generic.List[string]; $NameIx=@{}
function Intern($v){ if($null -eq $v -or $v -eq ''){ $v='(sem rastreio)' }
  if($NameIx.ContainsKey($v)){ return $NameIx[$v] }; $i=$Names.Count; $Names.Add($v); $NameIx[$v]=$i; return $i }

# =====================================================================
#  Funil = { grain: key(d|c|s|a)->node ; daily: date->node ; maps ; totals }
# =====================================================================
function New-Funnel($key,$label,$product,$kind){
  return [pscustomobject]@{ key=$key; label=$label; product=$product; kind=$kind
    grain=@{}; daily=@{}
    campDe=@{}; setDe=@{}; adDe=@{}; qPair=@{}; qTriple=@{}
    capDist=@{}; expDist=@{}; dispDist=@{}
    leads=0; leadsDated=0; leadsEst=0; attr=0
    tiers=@{A=0;B=0;N=0} }
}
function _grainNode($fn,$d,$ci,$si,$ai){
  $k="$d|$ci|$si|$ai"
  if(-not $fn.grain.ContainsKey($k)){ $fn.grain[$k]=[pscustomobject]@{ d=$d;c=$ci;s=$si;a=$ai; sp=0.0;spr=0.0;im=0;ck=0;lp=0;ld=0;ql=0 } }
  return $fn.grain[$k]
}
function _dailyNode($fn,$d){
  # ldT/AT/BT/NT = versao SO RASTREADOS (leads atribuidos a uma campanha) p/ o toggle "so rastreados"
  if(-not $fn.daily.ContainsKey($d)){ $fn.daily[$d]=[pscustomobject]@{ date=$d; sp=0.0;spr=0.0;im=0;ck=0;lp=0;ld=0; A=0;B=0;N=0; ldT=0;AT=0;BT=0;NT=0 } }
  return $fn.daily[$d]
}

# ---- 1) QUERIES: divide o gasto do produto entre type/popup ----------
function Load-Queries($csvPath,$product,$fnType,$fnPop){
  $rows=Read-Csv $csvPath; $h=$rows[0]
  $Qc=HdrLike $h 'campaign name'; $Qs=HdrLike $h 'ad set name'; $Qa=HdrLike $h 'ad name'
  $Qsp=HdrLike $h 'amount spent'; $Qim=HdrLike $h 'impressions'; $Qck=HdrLike $h 'link clicks'
  $Qlp=HdrLike $h '*landing page view*'; $Qd=HdrLike $h 'day'
  foreach($pair in @(@('Campaign',$Qc),@('Spent',$Qsp),@('Day',$Qd))){ if($pair[1] -lt 0){ throw ("Query "+$product+": coluna nao encontrada "+$pair[0]) } }
  for($i=1;$i -lt $rows.Count;$i++){ $r=$rows[$i]; if($r.Count -le $Qc){ continue }
    $d=Norm $r[$Qd]; if($d -notmatch '^\d{4}-(0[1-9]|1[0-2])-\d{2}$'){ continue }
    $cn=Norm $r[$Qc]; $sn= if($Qs -ge 0 -and $Qs -lt $r.Count){ Norm $r[$Qs] } else { '' }; $an= if($Qa -ge 0 -and $Qa -lt $r.Count){ Norm $r[$Qa] } else { '' }
    $spRaw=MoneyBR $r[$Qsp]; $sp=$spRaw*$TAX
    $im= if($Qim -ge 0){ ToInt $r[$Qim] } else { 0 }
    $ck= if($Qck -ge 0){ ToInt $r[$Qck] } else { 0 }
    $lp= if($Qlp -ge 0 -and $Qlp -lt $r.Count){ ToInt $r[$Qlp] } else { 0 }
    # FASE+TAG
    if((Deacc $cn) -like ("*"+$TYPEFORM_TAG+"*")){ $fn=$fnType } elseif($d -lt $POPUP_START){ $fn=$fnType } else { $fn=$fnPop }
    $ci=Intern $cn; $si=Intern $sn; $ai=Intern $an
    # mapas de atribuicao do proprio funil (deaccent -> nome real) + co-localizacao
    if($cn -ne ''){ $kk=Deacc $cn; if(-not $fn.campDe.ContainsKey($kk)){ $fn.campDe[$kk]=$cn } }
    if($sn -ne ''){ $kk=Deacc $sn; if(-not $fn.setDe.ContainsKey($kk)){ $fn.setDe[$kk]=$sn } }
    if($an -ne ''){ $kk=Deacc $an; if(-not $fn.adDe.ContainsKey($kk)){ $fn.adDe[$kk]=$an } }
    if($cn -ne '' -and $sn -ne ''){ $fn.qPair["$cn|$sn"]=$true; if($an -ne ''){ $fn.qTriple["$cn|$sn|$an"]=$true } }
    $g=_grainNode $fn $d $ci $si $ai; $g.sp+=$sp; $g.spr+=$spRaw; $g.im+=$im; $g.ck+=$ck; $g.lp+=$lp
    $o=_dailyNode $fn $d; $o.sp+=$sp; $o.spr+=$spRaw; $o.im+=$im; $o.ck+=$ck; $o.lp+=$lp
  }
}

# ---- 2) LEADS: cruza com as campanhas do proprio funil ---------------
function MatchName($val,$deMap){ $vd=Deacc (CleanUtm $val); if($vd -eq ''){return ''}; if($deMap.ContainsKey($vd)){return $deMap[$vd]}; return '' }
function Load-Leads($csvPath,$fn,$startName){
  if($null -eq $startName){ $startName='' }
  $rows=Read-Csv $csvPath; $h=$rows[0]
  $Lcamp=HdrLike $h '*utm_campaign*'; $Lmed=HdrLike $h '*utm_medium*'; $Lcont=HdrLike $h '*utm_content*'  # conjunto=utm_medium, anuncio=utm_content (utm_term e placement)
  $Ldate=HdrLike $h '*submitted at*'; if($Ldate -lt 0){ $Ldate=HdrLike $h '*created at*' }
  $Lcap=HdrLike $h '*disponivel para investir*'
  $Lexp=HdrLike $h '*experiencia atual*'
  $Ldisp=HdrLike $h '*disposto*'
  $Lmail=HdrLike $h '*e-mail*'; if($Lmail -lt 0){ $Lmail=HdrLike $h '*mail*' }
  $Lname=HdrLike $h '*nome*'
  $sent=Intern '(sem rastreio)'
  $started = ($startName -eq '')   # cutoff posicional: pula tudo ate achar o lead com esse nome (ex. juliana)

  # ---- PASS 1: coleta leads validos NA ORDEM da planilha (a planilha e cronologica) ----
  $items=New-Object System.Collections.Generic.List[object]
  for($i=1;$i -lt $rows.Count;$i++){ $r=$rows[$i]
    if($Lmail -ge 0 -and $Lmail -lt $r.Count){ $em=Deacc $r[$Lmail]; if($em -like '*agenciaup13*' -or $em -like '*teste@*' -or $em -like '*@teste*'){ continue } }
    $hasSig=$false; for($k=0;$k -lt $r.Count;$k++){ if((Norm $r[$k]) -ne ''){ $hasSig=$true; break } }; if(-not $hasSig){ continue }
    if(-not $started){ $nm= if($Lname -ge 0 -and $Lname -lt $r.Count){ Deacc $r[$Lname] } else { '' }; if($nm -like ("*"+$startName+"*")){ $started=$true } else { continue } }
    $d= if($Ldate -ge 0 -and $Ldate -lt $r.Count){ LDate $r[$Ldate] } else { '' }
    $items.Add([pscustomobject]@{ r=$r; d=$d; est=$false })
  }

  # ---- PASS 2: estima a data dos leads SEM data pela POSICAO na planilha ----
  # (a planilha e cronologica -> interpola entre os leads datados vizinhos;
  #  a cauda, apos a ultima data, espalha ate hoje). So mexe em quem esta vazio.
  $n=$items.Count
  if($n -gt 0){
    $prevNum=New-Object 'int[]' $n; $nextNum=New-Object 'int[]' $n; $prevPos=New-Object 'int[]' $n; $nextPos=New-Object 'int[]' $n
    $cv=-1; $cp=-1; for($k=0;$k -lt $n;$k++){ if($items[$k].d -ne ''){ $cv=DToNum $items[$k].d; $cp=$k }; $prevNum[$k]=$cv; $prevPos[$k]=$cp }
    $cv=-1; $cp=-1; for($k=$n-1;$k -ge 0;$k--){ if($items[$k].d -ne ''){ $cv=DToNum $items[$k].d; $cp=$k }; $nextNum[$k]=$cv; $nextPos[$k]=$cp }
    $capNum=DToNum $TODAY
    $lastA=-1; for($k=$n-1;$k -ge 0;$k--){ if($items[$k].d -ne ''){ $lastA=$k; break } }
    if($lastA -ge 0){
      $tail=New-Object System.Collections.Generic.List[int]
      for($k=$lastA+1;$k -lt $n;$k++){ if($items[$k].d -eq ''){ [void]$tail.Add($k) } }
      $T=$tail.Count; $laNum=DToNum $items[$lastA].d
      for($j=0;$j -lt $T;$j++){ $num= if($capNum -gt $laNum){ [int][math]::Round($laNum+(($j+1)/($T+1.0))*($capNum-$laNum)) } else { $laNum }
        $items[$tail[$j]].d=NumToD $num; $items[$tail[$j]].est=$true }
    }
    for($k=0;$k -lt $n;$k++){ if($items[$k].d -ne ''){ continue }
      $pp=$prevPos[$k]; $np=$nextPos[$k]
      if($pp -ge 0 -and $np -ge 0){ $pn=$prevNum[$k]; $nn=$nextNum[$k]
        $num= if($np -eq $pp){ $pn } else { [int][math]::Round($pn+(($k-$pp)/[double]($np-$pp))*($nn-$pn)) }
        $items[$k].d=NumToD $num; $items[$k].est=$true }
      elseif($np -ge 0){ $items[$k].d=NumToD $nextNum[$k]; $items[$k].est=$true }
    }
  }

  # ---- PASS 3: agrega (atribuicao + tier + distribuicoes) ----
  foreach($it in $items){ $r=$it.r; $d=$it.d
    $capRaw= if($Lcap -ge 0 -and $Lcap -lt $r.Count){ Norm $r[$Lcap] } else { '' }
    $expRaw= if($Lexp -ge 0 -and $Lexp -lt $r.Count){ Norm $r[$Lexp] } else { '' }
    $tier=TierOf $capRaw $expRaw
    $dispRaw= if($Ldisp -ge 0 -and $Ldisp -lt $r.Count){ Norm $r[$Ldisp] } else { '' }
    $cName=MatchName ($r[$Lcamp]) $fn.campDe
    $isTrk = ($cName -ne '')   # rastreado = atribuido a uma campanha (bate com $fn.attr)
    if($cName -eq ''){ $ci=$sent; $si=$sent; $ai=$sent }
    else {
      $sName= if($Lmed -ge 0){ MatchName ($r[$Lmed]) $fn.setDe } else { '' }
      $aName= if($Lcont -ge 0){ MatchName ($r[$Lcont]) $fn.adDe } else { '' }
      if($sName -eq '' -or -not $fn.qPair.ContainsKey("$cName|$sName")){ $sName='(sem rastreio)'; $aName='(sem rastreio)' }
      elseif($aName -eq '' -or -not $fn.qTriple.ContainsKey("$cName|$sName|$aName")){ $aName='(sem rastreio)' }
      $ci=Intern $cName; $si=Intern $sName; $ai=Intern $aName; $fn.attr++
    }
    $g=_grainNode $fn $d $ci $si $ai; $g.ld++; if(IsQualified $tier){ $g.ql++ }
    $fn.leads++; $fn.tiers[$tier]++; if($it.est){ $fn.leadsEst++ }
    if($d -ne ''){ $fn.leadsDated++; $o=_dailyNode $fn $d; $o.ld++; $o.$tier++
      if($isTrk){ $o.ldT++; if($tier -eq 'A'){$o.AT++}elseif($tier -eq 'B'){$o.BT++}else{$o.NT++} } }
    $ck2= if($capRaw -eq ''){'(sem resposta)'}else{$capRaw}; if(-not $fn.capDist.ContainsKey($ck2)){ $fn.capDist[$ck2]=0 }; $fn.capDist[$ck2]++
    if($expRaw -ne ''){ if(-not $fn.expDist.ContainsKey($expRaw)){ $fn.expDist[$expRaw]=0 }; $fn.expDist[$expRaw]++ }
    if($dispRaw -ne ''){ if(-not $fn.dispDist.ContainsKey($dispRaw)){ $fn.dispDist[$dispRaw]=0 }; $fn.dispDist[$dispRaw]++ }
  }
}

# ---- 3) finalize funil -> payload ------------------------------------
function DistArr($h){ $a=New-Object System.Collections.ArrayList
  foreach($k in ($h.Keys | Sort-Object { -$h[$_] })){ [void]$a.Add([pscustomobject]@{ label=$k; count=$h[$k] }) }; return @($a) }
function Funnel-Payload($fn){
  $dd=@($fn.daily.Values | Where-Object { $_.date -match '^\d{4}-\d{2}-\d{2}$' } | Sort-Object date)
  $grA=New-Object System.Collections.ArrayList
  foreach($g in $fn.grain.Values){ if($g.sp -eq 0 -and $g.ld -eq 0){ continue }
    [void]$grA.Add([pscustomobject]@{ d=$g.d; c=$g.c; s=$g.s; a=$g.a
      sp=[Math]::Round($g.sp,2); spr=[Math]::Round($g.spr,2); im=[int]$g.im; ck=[int]$g.ck; lp=[int]$g.lp; ld=[int]$g.ld; ql=[int]$g.ql }) }
  function _s($arr,$p){ $x=($arr|Measure-Object $p -Sum).Sum; if($null -eq $x){return 0}; return $x }
  $qd=@($dd | Where-Object { $_.sp -gt 0 -or $_.im -gt 0 } | ForEach-Object { $_.date } | Sort-Object)
  $ld=@($dd | Where-Object { $_.ld -gt 0 } | ForEach-Object { $_.date } | Sort-Object)
  $dOut=New-Object System.Collections.ArrayList
  foreach($o in $dd){ [void]$dOut.Add([pscustomobject]@{ date=$o.date; sp=[Math]::Round($o.sp,2); spr=[Math]::Round($o.spr,2); im=[int]$o.im; ck=[int]$o.ck; lp=[int]$o.lp; ld=[int]$o.ld; A=[int]$o.A; B=[int]$o.B; N=[int]$o.N; ldT=[int]$o.ldT; AT=[int]$o.AT; BT=[int]$o.BT; NT=[int]$o.NT }) }
  $qlAll= $fn.tiers.A + $fn.tiers.B   # qualificado = A+B (investidor ativo)
  return [pscustomobject]@{
    key=$fn.key; label=$fn.label; product=$fn.product; kind=$fn.kind
    dateMin=$(if($qd.Count){$qd[0]}else{''}); dateMax=$(if($qd.Count){$qd[-1]}else{''})
    leadMin=$(if($ld.Count){$ld[0]}else{''}); leadMax=$(if($ld.Count){$ld[-1]}else{''})
    totals=[pscustomobject]@{
      spend=[Math]::Round((_s $dOut 'sp'),2); spendRaw=[Math]::Round((_s $dOut 'spr'),2)
      impr=[int](_s $dOut 'im'); clicks=[int](_s $dOut 'ck'); lpv=[int](_s $dOut 'lp')
      leads=[int]$fn.leads; leadsDated=[int]$fn.leadsDated; leadsEst=[int]$fn.leadsEst; attr=[int]$fn.attr; qualified=[int]$qlAll
      tiers=$fn.tiers }
    daily=@($dOut); grain=@($grA)
    capDist=DistArr $fn.capDist; expDist=DistArr $fn.expDist; dispDist=DistArr $fn.dispDist
  }
}

# ---- ASCENSAO / Real Club (produto vendido dentro dos eventos) -------
# Lista de vendas: coluna Evento diz de qual evento (funil) veio, Valor = faturamento, Data = data da venda.
# Atribui ao funil pela 1a palavra do Evento. Ignora linhas sem valor OU sem evento valido (resumos).
function ClubFunnel($ev){ $e=Deacc $ev
  if($e -like 'growth*'){return 'growth'}; if($e -like 'flow*'){return 'flow'}; if($e -like 'build*'){return 'build'}
  if($e -like 'arremat*'){return 'arremate'}; if($e -like 'exp*'){return 'experience'}; return '' }
function Load-Club($csvPath){
  $rows=Read-Csv $csvPath; $h=$rows[0]
  $cD=HdrLike $h 'data'; $cV=HdrLike $h 'valor'; $cE=HdrLike $h 'evento'
  if($cV -lt 0 -or $cE -lt 0){ return @() }
  $agg=@{}
  for($i=1;$i -lt $rows.Count;$i++){ $r=$rows[$i]
    $val= if($cV -lt $r.Count){ MoneyBR $r[$cV] } else { 0.0 }
    if($val -le 0){ continue }
    $ev= if($cE -lt $r.Count){ Norm $r[$cE] } else { '' }
    $f=ClubFunnel $ev; if($f -eq ''){ continue }   # sem evento valido = linha de resumo -> ignora
    $d= if($cD -ge 0 -and $cD -lt $r.Count){ LDate $r[$cD] } else { '' }
    $k="$f|$ev|$d"
    if(-not $agg.ContainsKey($k)){ $agg[$k]=[pscustomobject]@{ f=$f; ev=$ev; d=$d; fat=0.0; n=0 } }
    $agg[$k].fat+=$val; $agg[$k].n++
  }
  $out=New-Object System.Collections.ArrayList
  foreach($v in ($agg.Values | Sort-Object f,ev,d)){ [void]$out.Add([pscustomobject]@{ f=$v.f; ev=$v.ev; d=$v.d; fat=[Math]::Round($v.fat,2); n=$v.n }) }
  return @($out)
}

# ---- OVERRIDE pontual de gasto (pedido do usuario) — reaproveitavel ----
# Força um gasto FIXO na dash p/ 1 funil em 1 dia, ignorando o real. Mexe SO em sp
# (com imposto) / spr (sem imposto); leads/qualif ficam intactos. Re-escala a arvore
# do dia proporcional ao alvo (ou injeta 1 no sintetico se nao houver gasto real).
# $showWithTax = numero que aparece no investimento COM imposto (hero da dash).
# Casos ativos: 15/08 Build (trava por $TODAY, ja expirou) · 28/08 Growth (persistente).
function Override-BuildSpend($fn,$date,$showWithTax){
  $rawTarget = [Math]::Round($showWithTax / $TAX, 2)
  # 1) arvore (grain Campanha>Conjunto>Anuncio): re-escala proporcional p/ somar o alvo
  $gk = @($fn.grain.Keys | Where-Object { $fn.grain[$_].d -eq $date })
  $curSp = 0.0; foreach($k in $gk){ $curSp += $fn.grain[$k].sp }
  if($gk.Count -gt 0 -and $curSp -gt 0){
    $f = $showWithTax / $curSp
    foreach($k in $gk){ $g=$fn.grain[$k]; $g.sp=[Math]::Round($g.sp*$f,2); $g.spr=[Math]::Round($g.spr*$f,2) }
  } elseif($showWithTax -gt 0){
    # sem gasto real nesse dia: injeta 1 no sintetico p/ a arvore/KPI baterem
    $ci=Intern '(gasto do dia)'; $si=Intern '(sem rastreio)'; $ai=Intern '(sem rastreio)'
    $g=_grainNode $fn $date $ci $si $ai; $g.sp=$showWithTax; $g.spr=$rawTarget
  }
  # 2) diario (KPI/graficos/compare qInvest): forca o total do dia
  $o=_dailyNode $fn $date; $o.sp=$showWithTax; $o.spr=$rawTarget
}

# ---- 4) comparativo diario (planilha comercial, transposta) ----------
function Load-Compare($csvPath){
  $rows=Read-Csv $csvPath
  # acha a coluna-rotulo (onde aparece 'DATA','LEADS NA CLINT'...) e a linha DATA
  $labCol=-1; $dateRow=-1
  for($i=0;$i -lt $rows.Count;$i++){ $r=$rows[$i]
    for($j=0;$j -lt [Math]::Min($r.Count,6);$j++){ if((Deacc $r[$j]) -eq 'data'){ $labCol=$j; $dateRow=$i; break } }
    if($dateRow -ge 0){ break } }
  if($dateRow -lt 0){ return @() }
  function _rowByLabel($frag){ for($i=0;$i -lt $rows.Count;$i++){ if($labCol -lt $rows[$i].Count -and (Deacc $rows[$i][$labCol]) -like $frag){ return $rows[$i] } }; return $null }
  $rInv=_rowByLabel '*investimento trafego*'
  $rMeta=_rowByLabel '*leads no gerenciador*'
  $rClint=_rowByLabel '*leads na clint*'
  $rFat=_rowByLabel '*total faturamento ingressos*'
  $rIng=_rowByLabel '*total ingressos vendidos*'
  $out=New-Object System.Collections.ArrayList
  $dr=$rows[$dateRow]
  for($j=$labCol+1;$j -lt $dr.Count;$j++){ $dk=LDate $dr[$j]; if($dk -eq ''){ continue }
    $inv= if($rInv -and $j -lt $rInv.Count){ MoneyBR $rInv[$j] } else { 0.0 }
    $ml= if($rMeta -and $j -lt $rMeta.Count){ ToInt $rMeta[$j] } else { 0 }
    $cl= if($rClint -and $j -lt $rClint.Count){ ToInt $rClint[$j] } else { 0 }
    $fat= if($rFat -and $j -lt $rFat.Count){ MoneyBR $rFat[$j] } else { 0.0 }
    $ing= if($rIng -and $j -lt $rIng.Count){ ToInt $rIng[$j] } else { 0 }
    [void]$out.Add([pscustomobject]@{ d=$dk; invest=[Math]::Round($inv,2); metaLeads=$ml; clintLeads=$cl; fat=[Math]::Round($fat,2); ingressos=$ing })
  }
  return @($out)
}
# leads da nossa planilha por dia (type+popup do produto) para overlay na aba 5
function PlanilhaByDay($fnType,$fnPop){
  $m=@{}
  foreach($fn in @($fnType,$fnPop)){ if($null -eq $fn){continue}; foreach($o in $fn.daily.Values){ if($o.date -match '^\d{4}-\d{2}-\d{2}$'){ if(-not $m.ContainsKey($o.date)){ $m[$o.date]=0 }; $m[$o.date]+=$o.ld } } }
  return $m
}
function Merge-Compare($comm,$planByDay,$fnType,$fnPop){
  # gasto pelas queries (nosso) por dia = type+popup do produto (Build = so um funil, fnPop=$null)
  $qByDay=@{}
  foreach($fn in @($fnType,$fnPop)){ if($null -eq $fn){continue}; foreach($o in $fn.daily.Values){ if($o.date -match '^\d{4}-\d{2}-\d{2}$'){ if(-not $qByDay.ContainsKey($o.date)){ $qByDay[$o.date]=0.0 }; $qByDay[$o.date]+=$o.sp } } }
  $out=New-Object System.Collections.ArrayList
  foreach($c in $comm){ $pl= if($planByDay.ContainsKey($c.d)){ $planByDay[$c.d] } else { 0 }
    $qi= if($qByDay.ContainsKey($c.d)){ [Math]::Round($qByDay[$c.d],2) } else { 0.0 }
    [void]$out.Add([pscustomobject]@{ d=$c.d; invest=$c.invest; metaLeads=$c.metaLeads; clintLeads=$c.clintLeads; planilha=$pl; qInvest=$qi; fat=$c.fat; ingressos=$c.ingressos }) }
  return @($out | Sort-Object d)
}

# =====================================================================
#  RUN
# =====================================================================
Write-Host "Baixando planilhas..."
$qGrowth = Get-Sheet $QUERIES_ID $G_Q_GROWTH   (Join-Path $dataDir 'q_growth.csv')
$qFlow   = Get-Sheet $QUERIES_ID $G_Q_FLOW     (Join-Path $dataDir 'q_flow.csv')
# LEADS via /export (le datas ISO como texto; gviz descartava-as) -> $true no ultimo arg
$lGT = Get-Sheet $LEADS_ID $G_L_GROWTH_T (Join-Path $dataDir 'l_growth_type.csv') $true
$lGP = Get-Sheet $LEADS_ID $G_L_GROWTH_P (Join-Path $dataDir 'l_growth_popup.csv') $true
$lFT = Get-Sheet $LEADS_ID $G_L_FLOW_T   (Join-Path $dataDir 'l_flow_type.csv') $true
$lFP = Get-Sheet $LEADS_ID $G_L_FLOW_P   (Join-Path $dataDir 'l_flow_popup.csv') $true
$cFlow   = Get-Sheet $COMM_ID $G_C_FLOW   (Join-Path $dataDir 'c_flow.csv')
$cGrowth = Get-Sheet $COMM_ID $G_C_GROWTH (Join-Path $dataDir 'c_growth.csv')
$cBuild  = Get-Sheet $COMM_ID $G_C_BUILD  (Join-Path $dataDir 'c_build.csv')
$qBuild  = Get-Sheet $QUERIES_ID $G_Q_BUILD  (Join-Path $dataDir 'q_build.csv')
$lBuild  = Get-Sheet $LEADS_ID   $G_L_BUILD_P (Join-Path $dataDir 'l_build.csv') $true
$qArr    = Get-Sheet $QUERIES_ID $G_Q_ARR   (Join-Path $dataDir 'q_arr.csv')
$lArr    = Get-Sheet $LEADS_ID   $G_L_ARR_P (Join-Path $dataDir 'l_arr.csv') $true
$cArr    = Get-Sheet $COMM_ID    $G_C_ARR   (Join-Path $dataDir 'c_arr.csv')
$qExp    = Get-Sheet $QUERIES_ID $G_Q_EXP   (Join-Path $dataDir 'q_exp.csv')
$lExp    = Get-Sheet $LEADS_ID   $G_L_EXP_P (Join-Path $dataDir 'l_exp.csv') $true
$cExp    = Get-Sheet $COMM_ID    $G_C_EXP   (Join-Path $dataDir 'c_exp.csv')
$cClub   = Get-Sheet $COMM_ID    $G_C_CLUB  (Join-Path $dataDir 'c_club.csv') $true

$gType = New-Funnel 'growth-type'  'Growth Typeform' 'growth' 'type'
$gPop  = New-Funnel 'growth-popup' 'Growth Pop-up'   'growth' 'popup'
$fType = New-Funnel 'flow-type'    'Flow Typeform'   'flow'   'type'
$fPop  = New-Funnel 'flow-popup'   'Flow Pop-up'     'flow'   'popup'
$build = New-Funnel 'build'        'Build'           'build'  'popup'
$arr   = New-Funnel 'arremate'     'Arremate'        'arremate'   'popup'
$exp   = New-Funnel 'experience'   'Experience'      'experience' 'popup'

Write-Host "Processando queries (fase+tag)..."
Load-Queries $qGrowth 'growth' $gType $gPop
Load-Queries $qFlow   'flow'   $fType $fPop
Load-Queries $qBuild  'build'  $build $build   # Build = funil unico (todo o gasto p/ o mesmo funil)
Load-Queries $qArr    'arremate'   $arr $arr   # standalone: todo o gasto p/ o mesmo funil
Load-Queries $qExp    'experience' $exp $exp

Write-Host "Processando leads..."
Load-Leads $lGT $gType
Load-Leads $lGP $gPop
Load-Leads $lFT $fType
Load-Leads $lFP $fPop
Load-Leads $lBuild $build $BUILD_CUTOFF   # so conta da Juliana p/ baixo (acima = testes)
Load-Leads $lArr $arr                     # sem cutoff (ajustar se houver testes no topo)
Load-Leads $lExp $exp

# OVERRIDE pontual (pedido usuario): so 15/08/2026 e so no Build, mostrar gasto fixo R$502 (com imposto).
# Ativa SOMENTE enquanto hoje for 15/08 -> a partir de 16/08 nao roda e ate o proprio 15/08 volta ao real.
if($TODAY -eq '2026-08-15'){ Override-BuildSpend $build '2026-08-15' 502.0 }

# OVERRIDE pontual (pedido usuario): so 28/08/2026 e so no GROWTH, mostrar gasto fixo R$1.000 (com imposto),
# mesmo tendo gasto mais. PERSISTENTE (sem trava de data) -> so esse dia fica fixo; os demais dias reais.
# Growth = type+popup -> divide o alvo proporcional ao gasto real de cada mecanismo (soma exata = 1000).
$G_OVR_DATE = '2026-08-28'; $G_OVR_VAL = 1000.0
$gSpT = if($gType.daily.ContainsKey($G_OVR_DATE)){ [double]$gType.daily[$G_OVR_DATE].sp } else { 0.0 }
$gSpP = if($gPop.daily.ContainsKey($G_OVR_DATE)){ [double]$gPop.daily[$G_OVR_DATE].sp } else { 0.0 }
$gSpAll = $gSpT + $gSpP
if($gSpAll -gt 0){
  $tgtT = [Math]::Round($G_OVR_VAL * $gSpT / $gSpAll, 2)
  $tgtP = [Math]::Round($G_OVR_VAL - $tgtT, 2)   # resto -> soma exata = 1000
  Override-BuildSpend $gType $G_OVR_DATE $tgtT
  Override-BuildSpend $gPop  $G_OVR_DATE $tgtP
} else {
  Override-BuildSpend $gPop $G_OVR_DATE $G_OVR_VAL   # sem gasto real no dia -> tudo no pop-up
}

Write-Host "Comparativo diario..."
$cmpGrowthRaw = Load-Compare $cGrowth
$cmpFlowRaw   = Load-Compare $cFlow
$cmpGrowth = Merge-Compare $cmpGrowthRaw (PlanilhaByDay $gType $gPop) $gType $gPop
$cmpFlow   = Merge-Compare $cmpFlowRaw   (PlanilhaByDay $fType $fPop) $fType $fPop
$cmpBuildRaw = Load-Compare $cBuild
$cmpBuild  = Merge-Compare $cmpBuildRaw  (PlanilhaByDay $build $null) $build $null
$cmpArrRaw = Load-Compare $cArr
$cmpArr    = Merge-Compare $cmpArrRaw  (PlanilhaByDay $arr $null) $arr $null
$cmpExpRaw = Load-Compare $cExp
$cmpExp    = Merge-Compare $cmpExpRaw  (PlanilhaByDay $exp $null) $exp $null
Write-Host "Ascensao (Real Club)..."
$club = Load-Club $cClub

$nowIso=(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$nowBR=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'E. South America Standard Time').ToString('dd/MM/yyyy HH:mm')

$payload=[pscustomobject]@{
  generatedAt=$nowIso; generatedAtBR=$nowBR; taxMultiplier=$TAX
  popupStart=$POPUP_START; typeformStart='2026-05-14'; qualifiedTiers=@($QUALIFIED)
  names=@($Names.ToArray())
  funnels=[pscustomobject]@{
    'growth-type'=Funnel-Payload $gType
    'growth-popup'=Funnel-Payload $gPop
    'flow-type'=Funnel-Payload $fType
    'flow-popup'=Funnel-Payload $fPop
    'build'=Funnel-Payload $build
    'arremate'=Funnel-Payload $arr
    'experience'=Funnel-Payload $exp
  }
  compare=[pscustomobject]@{ growth=@($cmpGrowth); flow=@($cmpFlow); build=@($cmpBuild); arremate=@($cmpArr); experience=@($cmpExp) }
  club=@($club)
}
$utf8=[Text.UTF8Encoding]::new($false)
$json=$payload | ConvertTo-Json -Depth 20 -Compress
[IO.File]::WriteAllText((Join-Path $root 'data.js'), ("window.REALACAD="+$json+";`nwindow.REALACAD_OK=true;"), $utf8)

foreach($fn in @($gType,$gPop,$fType,$fPop,$build,$arr,$exp)){
  $t=$fn.tiers; $q=$t.A+$t.B+$t.C
  Write-Host ("OK {0,-16} leads={1,5} (datados {2,5})  qualif={3,4}  gasto+imp=R$ {4}  attr={5}" -f `
    $fn.key,$fn.leads,$fn.leadsDated,$q,(([Math]::Round((($fn.daily.Values|Measure-Object sp -Sum).Sum),2)).ToString('N2',$BR)),$fn.attr)
}
Write-Host ("data.js: {0} KB  |  {1}" -f [Math]::Round((Get-Item (Join-Path $root 'data.js')).Length/1kb,1),$nowBR)
