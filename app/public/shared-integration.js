const brief = `Northstar renews January 31, 2027. Maya Chen owns the account [CRM].

Case 4821 about delayed shipment-alert emails remains open [SUPPORT]. Weekly active users are 64, previously 78. The cause of the change is unknown [USAGE].

A 12% discount was discussed. Approval is not recorded. SSO entitlement and the security follow-up owner remain unknown [CALL].

Proposed next action: Maya confirms pricing and entitlement with the responsible owners and assigns the security follow-up before customer use.`

export const preparedIntegration = Object.freeze({
  evidence_class: 'prepared_synthetic_reference',
  lineage_id: 'prepared-northstar-renewal-01',
  application_caller: 'demo-account-owner',
  account_id: 'northstar-freight',
  source_ids: ['CRM', 'CALL', 'SUPPORT', 'USAGE'],
  response: { id: 'prepared-message-northstar-01', type: 'message', role: 'assistant', content: [{ type: 'text', text: brief }], stop_reason: 'end_turn' }
})

function el(doc,tag,text='',className='') {const n=doc.createElement(tag);n.textContent=text;if(className)n.className=className;return n}

export function mountSharedIntegration(host,{role='engineer',githubRef='main',showRoleLinks=true,showModeHint=true,showLearningCheck=true}={}) {
  if(!host)return
  const doc=host.ownerDocument,engineer=role==='engineer'
  host.className='shared-integration'
  host.replaceChildren()
  host.append(el(doc,'h2','The same Northstar API workflow'))
  if(showRoleLinks) {
    const choices=el(doc,'nav','','bridge-roles actions');choices.setAttribute('aria-label','View the same integration for another audience')
    for(const [id,label,selected] of [['software-engineer-api','Engineer',engineer],['account-executive','Account executive',!engineer]]) {
      const a=el(doc,'a',label,'button secondary');a.href=`#path/${id}/2`;if(selected)a.setAttribute('aria-current','page');choices.append(a)
    }
    host.append(choices)
  }
  host.append(el(doc,'p','Prepared lineage: '+preparedIntegration.lineage_id,'small muted'))
  host.append(el(doc,'p',engineer?'Inspect the application access check, backend credential, request, typed response, and recovery path. The account executive reviews this same draft.':'The application performs the integration. You review its draft against the supplied records, identify unknowns, and choose the next action.'))
  host.append(el(doc,'p','The application checks Northstar access before loading records. Its backend holds the Claude credential. Neither the credential nor a finished response approves a customer claim.','notice'))
  const output=el(doc,engineer?'details':'section','','shared-draft')
  if(engineer)output.append(el(doc,'summary','Read the same prepared draft the account executive sees'))
  else output.append(el(doc,'h3','Draft ready for source review'))
  for(const text of brief.split('\n\n'))output.append(el(doc,'p',text))
  const sources=el(doc,'a','Compare with the four source notes','source-link');sources.href='#material/source-pack';output.append(sources);host.append(output)
  const typed=el(doc,'details','','reference');typed.append(el(doc,'summary','Inspect the typed response and completion boundary'))
  const pre=el(doc,'pre','','code');pre.dataset.language='json';pre.append(el(doc,'code',JSON.stringify(preparedIntegration.response,null,2)))
  typed.append(pre,el(doc,'p','end_turn finishes generation. The application still requires the needed fields and a source check before business use.'))
  host.append(typed)
  const map=el(doc,'details','','reference integration-map-shell');if(engineer)map.open=true
  map.append(el(doc,'summary','Trace access, credential, request, response, tools, delivery, and review'))
  const mapHost=el(doc,'div','','integration-map-host');mapHost.dataset.role=role;map.append(mapHost);host.append(map)
  if(showLearningCheck)host.append(el(doc,'p',engineer?'Learning check: explain one access boundary, one response field, and the next check when the visible result is incomplete.':'Learning check: name one supported customer claim, one unknown, and the person who owns the next action.','small'))
  if(showModeHint)host.append(el(doc,'p','Prepared synthetic reference. This lab simulates the request, typed response, and review boundary without a model or tool call.','small muted'))
  const source=el(doc,'a','Open this shared reference in GitHub','small');source.href=`https://github.com/cfregly/learn-claude-workshop/blob/${githubRef}/labs/integration/shared-integration.js`;source.rel='noopener noreferrer';host.append(source)
}
