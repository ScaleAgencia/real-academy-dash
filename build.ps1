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
$QUALIFIED    = @('A','B','C')  # faixas de capital consideradas "qualificado" (>= R$200k)

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

# ---- helpers --------------------------------------------------------
function Get-Sheet($id,$gid,$out){
  $url = "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&gid=$gid"
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
# leads do pop-up vem com o utm DUPLICADO ("<nome> <nome>" - macro Meta {{campaign.name}} renderizada 2x). Desdobra.
function DeDup($s){ $s=([string]$s).Trim(); $L=$s.Length; if($L -lt 3){ return $s }
  if($L % 2 -eq 1){ $m=($L-1)/2; if($s[$m] -eq ' ' -and $s.Substring(0,$m) -eq $s.Substring($m+1)){ return $s.Substring(0,$m) } }
  if($L % 2 -eq 0){ $m=$L/2; if($s.Substring(0,$m) -eq $s.Substring($m)){ return $s.Substring(0,$m) } }
  return $s }
function CleanUtm($s){ $s=Norm $s; if($s -eq '' -or $s.IndexOf('{{') -ge 0){ return '' }; return (DeDup $s) }

# faixa de capital (pergunta comum aos 2 mecanismos) -> A..E / NS
function CapTier($s){ $t=Deacc $s
  if($t -eq '' -or $t -like '*prefiro nao*'){ return 'NS' }
  if($t -like '*acima*1 milhao*'){ return 'A' }
  if($t -like '*500 mil*1 milhao*'){ return 'B' }
  if($t -like '*200 mil*500 mil*'){ return 'C' }
  if($t -like '*50 mil*200 mil*'){ return 'D' }
  if($t -like '*ate*50 mil*'){ return 'E' }
  return 'NS' }
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
    leads=0; leadsDated=0; attr=0
    tiers=@{A=0;B=0;C=0;D=0;E=0;NS=0} }
}
function _grainNode($fn,$d,$ci,$si,$ai){
  $k="$d|$ci|$si|$ai"
  if(-not $fn.grain.ContainsKey($k)){ $fn.grain[$k]=[pscustomobject]@{ d=$d;c=$ci;s=$si;a=$ai; sp=0.0;spr=0.0;im=0;ck=0;lp=0;ld=0;ql=0 } }
  return $fn.grain[$k]
}
function _dailyNode($fn,$d){
  if(-not $fn.daily.ContainsKey($d)){ $fn.daily[$d]=[pscustomobject]@{ date=$d; sp=0.0;spr=0.0;im=0;ck=0;lp=0;ld=0; A=0;B=0;C=0;D=0;E=0;NS=0 } }
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
function Load-Leads($csvPath,$fn){
  $rows=Read-Csv $csvPath; $h=$rows[0]
  $Lcamp=HdrLike $h '*utm_campaign*'; $Lmed=HdrLike $h '*utm_medium*'; $Lcont=HdrLike $h '*utm_content*'  # conjunto=utm_medium, anuncio=utm_content (utm_term e placement)
  $Ldate=HdrLike $h '*submitted at*'; if($Ldate -lt 0){ $Ldate=HdrLike $h '*created at*' }
  $Lcap=HdrLike $h '*disponivel para investir*'
  $Lexp=HdrLike $h '*experiencia atual*'
  $Ldisp=HdrLike $h '*disposto*'
  $Lmail=HdrLike $h '*e-mail*'; if($Lmail -lt 0){ $Lmail=HdrLike $h '*mail*' }
  $sent=Intern '(sem rastreio)'
  for($i=1;$i -lt $rows.Count;$i++){ $r=$rows[$i]
    if($Lmail -ge 0 -and $Lmail -lt $r.Count){ $em=Deacc $r[$Lmail]; if($em -like '*agenciaup13*' -or $em -like '*teste@*' -or $em -like '*@teste*'){ continue } }
    $hasSig=$false
    for($k=0;$k -lt $r.Count;$k++){ if((Norm $r[$k]) -ne ''){ $hasSig=$true; break } }
    if(-not $hasSig){ continue }
    $d= if($Ldate -ge 0 -and $Ldate -lt $r.Count){ LDate $r[$Ldate] } else { '' }
    # capital / experiencia / disposto (distribuicoes + tier)
    $capRaw= if($Lcap -ge 0 -and $Lcap -lt $r.Count){ Norm $r[$Lcap] } else { '' }
    $tier=CapTier $capRaw
    $expRaw= if($Lexp -ge 0 -and $Lexp -lt $r.Count){ Norm $r[$Lexp] } else { '' }
    $dispRaw= if($Ldisp -ge 0 -and $Ldisp -lt $r.Count){ Norm $r[$Ldisp] } else { '' }
    # atribuicao lead->campanha (co-localizacao com o gasto do funil)
    $cName=MatchName ($r[$Lcamp]) $fn.campDe
    if($cName -eq ''){ $ci=$sent; $si=$sent; $ai=$sent }
    else {
      $sName= if($Lmed -ge 0){ MatchName ($r[$Lmed]) $fn.setDe } else { '' }
      $aName= if($Lcont -ge 0){ MatchName ($r[$Lcont]) $fn.adDe } else { '' }
      if($sName -eq '' -or -not $fn.qPair.ContainsKey("$cName|$sName")){ $sName='(sem rastreio)'; $aName='(sem rastreio)' }
      elseif($aName -eq '' -or -not $fn.qTriple.ContainsKey("$cName|$sName|$aName")){ $aName='(sem rastreio)' }
      $ci=Intern $cName; $si=Intern $sName; $ai=Intern $aName; $fn.attr++
    }
    $g=_grainNode $fn $d $ci $si $ai; $g.ld++; if(IsQualified $tier){ $g.ql++ }
    $fn.leads++; $fn.tiers[$tier]++
    if($d -ne ''){ $fn.leadsDated++; $o=_dailyNode $fn $d; $o.ld++; $o.$tier++ }
    # distribuicoes (rotulo cru da planilha)
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
  foreach($o in $dd){ [void]$dOut.Add([pscustomobject]@{ date=$o.date; sp=[Math]::Round($o.sp,2); spr=[Math]::Round($o.spr,2); im=[int]$o.im; ck=[int]$o.ck; lp=[int]$o.lp; ld=[int]$o.ld; A=[int]$o.A; B=[int]$o.B; C=[int]$o.C; D=[int]$o.D; E=[int]$o.E; NS=[int]$o.NS }) }
  $qlAll= $fn.tiers.A + $fn.tiers.B + $fn.tiers.C   # qualificado (>= R$200k) - alinhado a $QUALIFIED
  return [pscustomobject]@{
    key=$fn.key; label=$fn.label; product=$fn.product; kind=$fn.kind
    dateMin=$(if($qd.Count){$qd[0]}else{''}); dateMax=$(if($qd.Count){$qd[-1]}else{''})
    leadMin=$(if($ld.Count){$ld[0]}else{''}); leadMax=$(if($ld.Count){$ld[-1]}else{''})
    totals=[pscustomobject]@{
      spend=[Math]::Round((_s $dOut 'sp'),2); spendRaw=[Math]::Round((_s $dOut 'spr'),2)
      impr=[int](_s $dOut 'im'); clicks=[int](_s $dOut 'ck'); lpv=[int](_s $dOut 'lp')
      leads=[int]$fn.leads; leadsDated=[int]$fn.leadsDated; attr=[int]$fn.attr; qualified=[int]$qlAll
      tiers=$fn.tiers }
    daily=@($dOut); grain=@($grA)
    capDist=DistArr $fn.capDist; expDist=DistArr $fn.expDist; dispDist=DistArr $fn.dispDist
  }
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
  foreach($fn in @($fnType,$fnPop)){ foreach($o in $fn.daily.Values){ if($o.date -match '^\d{4}-\d{2}-\d{2}$'){ if(-not $m.ContainsKey($o.date)){ $m[$o.date]=0 }; $m[$o.date]+=$o.ld } } }
  return $m
}
function Merge-Compare($comm,$planByDay,$fnType,$fnPop){
  # gasto pelas queries (nosso) por dia = type+popup do produto
  $qByDay=@{}
  foreach($fn in @($fnType,$fnPop)){ foreach($o in $fn.daily.Values){ if($o.date -match '^\d{4}-\d{2}-\d{2}$'){ if(-not $qByDay.ContainsKey($o.date)){ $qByDay[$o.date]=0.0 }; $qByDay[$o.date]+=$o.sp } } }
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
$lGT = Get-Sheet $LEADS_ID $G_L_GROWTH_T (Join-Path $dataDir 'l_growth_type.csv')
$lGP = Get-Sheet $LEADS_ID $G_L_GROWTH_P (Join-Path $dataDir 'l_growth_popup.csv')
$lFT = Get-Sheet $LEADS_ID $G_L_FLOW_T   (Join-Path $dataDir 'l_flow_type.csv')
$lFP = Get-Sheet $LEADS_ID $G_L_FLOW_P   (Join-Path $dataDir 'l_flow_popup.csv')
$cFlow   = Get-Sheet $COMM_ID $G_C_FLOW   (Join-Path $dataDir 'c_flow.csv')
$cGrowth = Get-Sheet $COMM_ID $G_C_GROWTH (Join-Path $dataDir 'c_growth.csv')

$gType = New-Funnel 'growth-type'  'Growth Typeform' 'growth' 'type'
$gPop  = New-Funnel 'growth-popup' 'Growth Pop-up'   'growth' 'popup'
$fType = New-Funnel 'flow-type'    'Flow Typeform'   'flow'   'type'
$fPop  = New-Funnel 'flow-popup'   'Flow Pop-up'     'flow'   'popup'

Write-Host "Processando queries (fase+tag)..."
Load-Queries $qGrowth 'growth' $gType $gPop
Load-Queries $qFlow   'flow'   $fType $fPop

Write-Host "Processando leads..."
Load-Leads $lGT $gType
Load-Leads $lGP $gPop
Load-Leads $lFT $fType
Load-Leads $lFP $fPop

Write-Host "Comparativo diario..."
$cmpGrowthRaw = Load-Compare $cGrowth
$cmpFlowRaw   = Load-Compare $cFlow
$cmpGrowth = Merge-Compare $cmpGrowthRaw (PlanilhaByDay $gType $gPop) $gType $gPop
$cmpFlow   = Merge-Compare $cmpFlowRaw   (PlanilhaByDay $fType $fPop) $fType $fPop

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
  }
  compare=[pscustomobject]@{ growth=@($cmpGrowth); flow=@($cmpFlow) }
}
$utf8=[Text.UTF8Encoding]::new($false)
$json=$payload | ConvertTo-Json -Depth 20 -Compress
[IO.File]::WriteAllText((Join-Path $root 'data.js'), ("window.REALACAD="+$json+";`nwindow.REALACAD_OK=true;"), $utf8)

foreach($fn in @($gType,$gPop,$fType,$fPop)){
  $t=$fn.tiers; $q=$t.A+$t.B+$t.C
  Write-Host ("OK {0,-16} leads={1,5} (datados {2,5})  qualif={3,4}  gasto+imp=R$ {4}  attr={5}" -f `
    $fn.key,$fn.leads,$fn.leadsDated,$q,(([Math]::Round((($fn.daily.Values|Measure-Object sp -Sum).Sum),2)).ToString('N2',$BR)),$fn.attr)
}
Write-Host ("data.js: {0} KB  |  {1}" -f [Math]::Round((Get-Item (Join-Path $root 'data.js')).Length/1kb,1),$nowBR)
